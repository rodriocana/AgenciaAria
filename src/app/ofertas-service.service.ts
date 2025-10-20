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
  aplicada: boolean;
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

  // Obtener todas las ofertas
  getOfertas(): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<JobOffer[]>(`${this.apiUrl}/offers`, { headers });
  }

  // Aplicar a una oferta
  aplicarOferta(idOferta: number): Observable<any> {
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
    return this.http.post(`${this.apiUrl}/trabajador-oferta`, trabajadorOferta, { headers });
  }

  // Desaplicar una oferta
desaplicarOferta(idOferta: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
        return throwError(() => new Error('No hay token de autenticación'));
    }

    const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
    });
    const body = { id_oferta: idOferta };
    return this.http.delete(`${this.apiUrl}/trabajador-oferta`, { headers, body });
}

  // Obtener ofertas aplicadas por el trabajador
  getOfertasAplicadas(idTrabajador: number): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<JobOffer[]>(`${this.apiUrl}/trabajador-oferta/${idTrabajador}`, { headers });
  }

  // Obtener fechas de ofertas para el calendario
  getOfertasParaCalendario(idTrabajador?: number): Observable<JobOffer[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    if (idTrabajador) {
      // Para trabajadores, combinar ofertas abiertas y aplicadas
      return forkJoin([
        this.http.get<JobOffer[]>(`${this.apiUrl}/offers`, { headers }), // Todas las ofertas
        this.http.get<JobOffer[]>(`${this.apiUrl}/trabajador-oferta/${idTrabajador}`, { headers }) // Ofertas aplicadas
      ]).pipe(
        map(([allOffers, appliedOffers]) => {
          const appliedOfferIds = new Set(appliedOffers.map(offer => offer.id));
          return allOffers.map(offer => ({
            ...offer,
            aplicada: appliedOfferIds.has(offer.id) ? true : offer.aplicada || false
          }));
        })
      );
    } else {
      // Para administradores, obtener todas las ofertas
      return this.http.get<JobOffer[]>(`${this.apiUrl}/offers`, { headers });
    }
  }

  // Crear una nueva oferta
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
}
