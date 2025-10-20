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

        // Guardar la contraseña en texto plano (SIN HASH)
        console.log('Contraseña almacenada:', contrasena); // Log para depuración
        await connection.execute(
            'INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, contrasena, rol || 'trabajador']
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
    console.log('Cuerpo de la solicitud:', req.body); // Agrega este log
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Faltan correo o contraseña en la solicitud' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        console.log('Usuarios encontrados:', users);

        if (users.length === 0) {
            await connection.end();
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = users[0];
        // Comparar contraseña en texto plano
        const isMatch = contrasena === user.contrasena;
        console.log('¿Contraseña coincide?', isMatch);

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
        const idTrabajador = req.user.id;

        const [offers] = await connection.execute(
            `SELECT o.id, o.titulo, o.descripcion, DATE_FORMAT(o.fecha, '%Y-%m-%d') AS fecha, o.creado_por, o.fecha_creacion, o.estado,
                    EXISTS (
                        SELECT 1 FROM inscripciones_oferta io
                        WHERE io.id_oferta = o.id AND io.id_trabajador = ?
                    ) AS inscrita
             FROM ofertas_trabajo o`,
            [idTrabajador]
        );

        await connection.end();
        res.json(offers);
    } catch (error) {
        console.error('Error al obtener ofertas:', error);
        res.status(500).json({ error: 'Error al obtener las ofertas de trabajo' });
    }
});

// Endpoint: Inscribirse a una oferta
app.post('/api/inscripciones-oferta', authenticateToken, async (req, res) => {
    const { id_oferta } = req.body;
    const id_trabajador = req.user.id;

    if (!id_oferta) {
        return res.status(400).json({ error: 'Falta id_oferta en la solicitud' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Verificar si la oferta existe y está abierta
        const [offers] = await connection.execute(
            'SELECT estado FROM ofertas_trabajo WHERE id = ?',
            [id_oferta]
        );
        if (offers.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Oferta no encontrada' });
        }
        if (offers[0].estado === 'closed') {
            await connection.end();
            return res.status(400).json({ error: 'La oferta ya está cerrada' });
        }

        // Verificar si el trabajador ya se inscribió a esta oferta
        const [existingInscription] = await connection.execute(
            'SELECT id FROM inscripciones_oferta WHERE id_trabajador = ? AND id_oferta = ?',
            [id_trabajador, id_oferta]
        );
        if (existingInscription.length > 0) {
            await connection.end();
            return res.status(400).json({ error: 'Ya te has inscrito a esta oferta' });
        }

        // Registrar la inscripción
        await connection.execute(
            'INSERT INTO inscripciones_oferta (id_trabajador, id_oferta) VALUES (?, ?)',
            [id_trabajador, id_oferta]
        );

        await connection.end();
        res.status(201).json({ message: 'Inscripción registrada correctamente' });
    } catch (error) {
        console.error('Error al registrar inscripción:', error);
        res.status(500).json({ error: 'Error al registrar la inscripción' });
    }
});

// Endpoint: Desinscribirse de una oferta
app.delete('/api/inscripciones-oferta', authenticateToken, async (req, res) => {
    const { id_oferta } = req.body;
    const id_trabajador = req.user.id;

    if (!id_oferta) {
        return res.status(400).json({ error: 'Falta id_oferta en la solicitud' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Verificar si el trabajador está inscrito
        const [existingInscription] = await connection.execute(
            'SELECT id FROM inscripciones_oferta WHERE id_trabajador = ? AND id_oferta = ?',
            [id_trabajador, id_oferta]
        );
        if (existingInscription.length === 0) {
            await connection.end();
            return res.status(400).json({ error: 'No estás inscrito en esta oferta' });
        }

        // Eliminar la inscripción
        await connection.execute(
            'DELETE FROM inscripciones_oferta WHERE id_trabajador = ? AND id_oferta = ?',
            [id_trabajador, id_oferta]
        );

        await connection.end();
        res.status(200).json({ message: 'Inscripción eliminada correctamente' });
    } catch (error) {
        console.error('Error al desinscribirse:', error);
        res.status(500).json({ error: 'Error al desinscribirse de la oferta' });
    }
});

// Endpoint: Obtener ofertas con al menos un inscrito o asignado (solo administradores)
app.get('/api/admin-offers', authenticateToken, async (req, res) => {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado, solo administradores' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [offers] = await connection.execute(
      `SELECT DISTINCT o.id, o.titulo, o.descripcion, DATE_FORMAT(o.fecha, '%Y-%m-%d') AS fecha,
              o.creado_por, o.fecha_creacion, o.estado,
              FALSE AS inscrita
       FROM ofertas_trabajo o
       WHERE EXISTS (SELECT 1 FROM inscripciones_oferta io WHERE io.id_oferta = o.id)
          OR EXISTS (SELECT 1 FROM trabajador_oferta tof WHERE tof.id_oferta = o.id)`,
      []
    );

    await connection.end();
    res.json(offers);
  } catch (error) {
    console.error('Error al obtener ofertas con inscritos/asignados:', error);
    res.status(500).json({ error: 'Error al obtener las ofertas con inscritos/asignados' });
  }
});

// Endpoint: Obtener ofertas confirmadas por un trabajador
app.get('/api/trabajador-oferta/:idTrabajador', authenticateToken, async (req, res) => {
    const idTrabajador = req.params.idTrabajador;

    if (req.user.id != idTrabajador && req.user.rol !== 'administrador') {
        return res.status(403).json({ error: 'No tienes permiso para ver estas aplicaciones' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [offers] = await connection.execute(
            `SELECT o.id, o.titulo, o.descripcion, DATE_FORMAT(o.fecha, '%Y-%m-%d') AS fecha, o.creado_por, o.fecha_creacion, o.estado, TRUE AS aplicada
             FROM ofertas_trabajo o
             INNER JOIN trabajador_oferta tof ON o.id = tof.id_oferta
             WHERE tof.id_trabajador = ?`,
            [idTrabajador]
        );

        await connection.end();
        res.json(offers);
    } catch (error) {
        console.error('Error al obtener aplicaciones:', error);
        res.status(500).json({ error: 'Error al obtener las aplicaciones' });
    }
});

// Endpoint: Crear una oferta de trabajo (solo administradores)
app.post('/api/offers', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'administrador') {
        return res.status(403).json({ error: 'Acceso denegado, solo administradores' });
    }

    const { titulo, descripcion, fecha } = req.body;
    const creado_por = req.user.id;

    if (!titulo || !descripcion || !fecha) {
        return res.status(400).json({ error: 'Faltan campos requeridos: titulo, descripcion, fecha' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO ofertas_trabajo (titulo, descripcion, fecha, creado_por, estado) VALUES (?, ?, ?, ?, ?)',
            [titulo, descripcion, fecha, creado_por, 'open']
        );

        await connection.end();
        res.status(201).json({ message: 'Oferta creada correctamente' });
    } catch (error) {
        console.error('Error al crear oferta:', error);
        res.status(500).json({ error: 'Error al crear la oferta' });
    }
});


// Endpoint: Obtener inscripciones o asignados por oferta (solo administradores)
app.get('/api/inscripciones-oferta/:idOferta', authenticateToken, async (req, res) => {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado, solo administradores' });
  }

  const idOferta = req.params.idOferta;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Obtener el estado de la oferta
    const [offer] = await connection.execute(
      'SELECT estado FROM ofertas_trabajo WHERE id = ?',
      [idOferta]
    );

    if (offer.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    let inscriptions = [];
    const estado = offer[0].estado;

    if (estado === 'open') {
      // Para ofertas abiertas: mostrar inscritos pendientes (inscripciones_oferta)
      [inscriptions] = await connection.execute(
        `SELECT io.id, io.id_trabajador, io.id_oferta, io.fecha_inscripcion, u.nombre, u.correo
         FROM inscripciones_oferta io
         INNER JOIN usuarios u ON io.id_trabajador = u.id
         WHERE io.id_oferta = ?`,
        [idOferta]
      );
    } else {
      // Para ofertas cerradas: mostrar trabajadores asignados (trabajador_oferta)
      [inscriptions] = await connection.execute(
        `SELECT NULL as id, tof.id_trabajador, tof.id_oferta, tof.fecha_asignacion as fecha_inscripcion, u.nombre, u.correo
         FROM trabajador_oferta tof
         INNER JOIN usuarios u ON tof.id_trabajador = u.id
         WHERE tof.id_oferta = ?`,
        [idOferta]
      );
    }

    await connection.end();
    res.json(inscriptions);
  } catch (error) {
    console.error('Error al obtener inscripciones/asignados:', error);
    res.status(500).json({ error: 'Error al obtener las inscripciones/asignados' });
  }
});

// Endpoint: Asociar trabajador a oferta (solo administradores) - Actualizado para incluir fecha_asignacion
app.post('/api/asociar-trabajador-oferta', authenticateToken, async (req, res) => {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado, solo administradores' });
  }

  const { id_trabajador, id_oferta } = req.body;

  if (!id_trabajador || !id_oferta) {
    return res.status(400).json({ error: 'Faltan id_trabajador o id_oferta' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si el trabajador está inscrito
    const [existingInscription] = await connection.execute(
      'SELECT id, fecha_inscripcion FROM inscripciones_oferta WHERE id_trabajador = ? AND id_oferta = ?',
      [id_trabajador, id_oferta]
    );
    if (existingInscription.length === 0) {
      await connection.end();
      return res.status(400).json({ error: 'El trabajador no está inscrito en esta oferta' });
    }

    // Verificar si la oferta ya está asignada al trabajador
    const [existingAssignment] = await connection.execute(
      'SELECT id FROM trabajador_oferta WHERE id_trabajador = ? AND id_oferta = ?',
      [id_trabajador, id_oferta]
    );
    if (existingAssignment.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'El trabajador ya está asignado a esta oferta' });
    }

    const fechaAsignacion = existingInscription[0].fecha_inscripcion;

    // Iniciar transacción
    await connection.beginTransaction();
    try {
      // Insertar en trabajador_oferta con la fecha de inscripción original
      await connection.execute(
        'INSERT INTO trabajador_oferta (id_trabajador, id_oferta, fecha_asignacion) VALUES (?, ?, ?)',
        [id_trabajador, id_oferta, fechaAsignacion]
      );

      // Eliminar la inscripción
      await connection.execute(
        'DELETE FROM inscripciones_oferta WHERE id_trabajador = ? AND id_oferta = ?',
        [id_trabajador, id_oferta]
      );

      // Cerrar la oferta
      await connection.execute(
        'UPDATE ofertas_trabajo SET estado = "closed" WHERE id = ?',
        [id_oferta]
      );

      await connection.commit();
      await connection.end();
      res.status(201).json({ message: 'Trabajador asignado correctamente' });
    } catch (error) {
      await connection.rollback();
      await connection.end();
      console.error('Error al asociar trabajador:', error);
      res.status(500).json({ error: 'Error al asociar el trabajador' });
    }
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
