const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// Configuración de la conexión a MySQL
const dbConfig = {
    host: 'localhost',
    user: 'root', // Reemplaza con tu usuario de MySQL
    password: '', // Reemplaza con tu contraseña
    database: 'agencia'
};

// Clave secreta para JWT (cámbiala por una más segura en producción)
const JWT_SECRET = 'your_jwt_secret_key';

// Middleware para verificar el token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acceso denegado, token requerido' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// Endpoint: Registro de usuario
app.post('/api/register', async (req, res) => {
    const { nombre, correo, contrasena, rol } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existingUsers] = await connection.execute('SELECT correo FROM usuarios WHERE correo = ?', [correo]);
        if (existingUsers.length > 0) {
            await connection.end();
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);
        await connection.execute(
            'INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, hashedPassword, rol || 'trabajador']
        );

        await connection.end();
        res.status(201).json({ message: 'Usuario registrado correctamente' });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
});

// Endpoint: Login
app.post('/api/login', async (req, res) => {
    const { correo, contrasena } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT * FROM usuarios WHERE correo = ?', [correo]);

        if (users.length === 0) {
            await connection.end();
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(contrasena, user.contrasena);

        if (!isMatch) {
            await connection.end();
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '1h' });

        await connection.end();
        res.json({ token, user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol } });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// Endpoint: Obtener perfil del usuario
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT id, nombre, correo, rol FROM usuarios WHERE id = ?', [req.user.id]);

        if (users.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await connection.end();
        res.json(users[0]);
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
});

// Endpoint: Obtener ofertas de trabajo
app.get('/api/offers', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [offers] = await connection.execute(
            'SELECT id, titulo, descripcion, fecha, creado_por, fecha_creacion, estado FROM ofertas_trabajo'
        );

        await connection.end();
        res.json(offers);
    } catch (error) {
        console.error('Error al obtener ofertas:', error);
        res.status(500).json({ error: 'Error al obtener las ofertas de trabajo' });
    }
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
