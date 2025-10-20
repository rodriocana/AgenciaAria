import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth-service.service';

interface JobOffer {
  id: number;
  titulo: string;
  descripcion: string;
  fecha: string;
  creado_por: number;
  fecha_creacion: string;
  estado: 'open' | 'closed';
  inscrita: boolean;
}

interface Inscription {
  id: number;
  id_trabajador: number;
  id_oferta: number;
  fecha_inscripcion: string;
  nombre: string;
  correo: string;
}

interface TrabajadorOferta {
  id_trabajador: number;
  id_oferta: number;
}

interface NuevaOferta {
  titulo: string;
  descripcion: string;
  fecha: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfertasService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Obtener todas las ofertas (para /dashboard)
  getOfertas(): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<JobOffer[]>(`${this.apiUrl}/offers`, { headers });
  }

  // Obtener ofertas con al menos un inscrito (para /admin-offers)
  getAdminOffers(): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<JobOffer[]>(`${this.apiUrl}/admin-offers`, { headers });
  }

  // Resto de los métodos sin cambios
  inscribirseOferta(idOferta: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const user = this.authService.getUser();
    if (!user || !user.id) {
      return throwError(() => new Error('Usuario no autenticado o ID no disponible'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    const trabajadorOferta: TrabajadorOferta = {
      id_trabajador: user.id,
      id_oferta: idOferta
    };
    return this.http.post(`${this.apiUrl}/inscripciones-oferta`, { id_oferta: idOferta }, { headers });
  }

  desinscribirseOferta(idOferta: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    const body = { id_oferta: idOferta };
    return this.http.delete(`${this.apiUrl}/inscripciones-oferta`, { headers, body });
  }

  getOfertasAplicadas(idTrabajador: number): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<JobOffer[]>(`${this.apiUrl}/trabajador-oferta/${idTrabajador}`, { headers });
  }

  getOfertasParaCalendario(idTrabajador?: number): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    if (idTrabajador) {
      return forkJoin([
        this.http.get<JobOffer[]>(`${this.apiUrl}/offers`, { headers }),
        this.http.get<JobOffer[]>(`${this.apiUrl}/trabajador-oferta/${idTrabajador}`, { headers })
      ]).pipe(
        map(([allOffers, confirmedOffers]) => {
          const confirmedOfferIds = new Set(confirmedOffers.map(offer => offer.id));
          return allOffers.map(offer => ({
            ...offer,
            inscrita: offer.inscrita || confirmedOfferIds.has(offer.id)
          }));
        })
      );
    } else {
      return this.http.get<JobOffer[]>(`${this.apiUrl}/offers`, { headers });
    }
  }

  crearOferta(oferta: NuevaOferta): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post(`${this.apiUrl}/offers`, oferta, { headers });
  }

  getInscripcionesOferta(idOferta: number): Observable<Inscription[]> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<Inscription[]>(`${this.apiUrl}/inscripciones-oferta/${idOferta}`, { headers });
  }

  asociarTrabajadorOferta(idTrabajador: number, idOferta: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post(
      `${this.apiUrl}/asociar-trabajador-oferta`,
      { id_trabajador: idTrabajador, id_oferta: idOferta },
      { headers }
    );
  }
}
