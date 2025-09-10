
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../auth-service.service';

interface JobOffer {
  id: number;
  titulo: string;
  descripcion: string;
  fecha: string;
  creado_por: number;
  fecha_creacion: string;
  estado: string; // 'open' o 'closed'
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  isMenuOpen = false;
  jobOffers: JobOffer[] = [];

  constructor(
    public authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (!this.authService.getToken()) {
      this.router.navigate(['/login']);
    }
    this.loadJobOffers();
  }

  loadJobOffers(): void {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<JobOffer[]>('http://localhost:3000/api/offers', { headers }).subscribe({
      next: (offers) => {
        this.jobOffers = offers;
      },
      error: (err) => {
        console.error('Error al cargar ofertas:', err);
        if (err.status === 401 || err.status === 403) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
