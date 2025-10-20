import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { OfertasService } from '../ofertas-service.service';
import { AuthService } from '../auth-service.service';
import { DocumentService } from '../document-service.service';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

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

interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

interface Document {
  id: number;
  id_usuario: number;
  nombre_documento: string;
  url_documento: string;
  fecha_subida: string;
}

interface Inscription {
  id: number;
  id_trabajador: number;
  id_oferta: number;
  fecha_inscripcion: string;
  nombre: string;
  correo: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, FullCalendarModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit {
  isMenuOpen = false;
  jobOffers: JobOffer[] = [];
  appliedOffers: JobOffer[] = [];
  documents: Document[] = [];
  inscriptions: Inscription[] = [];
  selectedOffer: JobOffer | null = null;
  viewMode: 'available' | 'applied' | 'profile' | 'admin' = 'available';
  isModalOpen = false;
  nuevaOferta = { titulo: '', descripcion: '', fecha: '' };
  user: User | null = null;
  selectedFile: File | null = null;
  isLoading = false;
  isUploading = false;
  isLoadingDocuments = false;
  isLoadingInscriptions = false;
  calendarEvents: EventInput[] = [];
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    events: [],
    eventClick: this.handleDateClick.bind(this),
    height: 'auto',
    eventDidMount: (info) => {
      info.el.title = info.event.title; // Mostrar título como tooltip
    }
  };
  filteredOffers: JobOffer[] = [];
  offerFilter: 'all' | 'open' | 'closed' = 'all';

  constructor(
    public authService: AuthService,
    public router: Router,
    private route: ActivatedRoute,
    private ofertasService: OfertasService,
    private documentService: DocumentService,
    private toastr: ToastrService
  ) {}



  ngOnInit(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.toastr.error('No hay sesión activa', 'Error');
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserData();

    this.route.url.subscribe(url => {
      const path = url[0]?.path;
      if (path === 'profile') {
        this.viewMode = 'profile';
      } else if (path === 'offers') {
        this.viewMode = 'applied';
      } else if (path === 'admin-offers') {
        this.viewMode = 'admin';
      } else {
        this.viewMode = 'available';
      }
      this.loadContent();
    });
  }


  loadUserData(): void {
    this.isLoading = true;
    this.user = this.authService.getUser();
    if (!this.user) {
      this.toastr.error('No se pudieron cargar los datos del usuario', 'Error');
    }
    this.isLoading = false;
  }

  loadContent(): void {
    if (this.viewMode === 'profile') {
      this.loadDocuments();
    } else if (this.viewMode === 'admin') {
      this.loadOffers();
    } else {
      this.loadOffers();
      if (this.viewMode === 'available') {
        this.loadCalendarEvents();
      }
    }
  }

loadOffers(): void {
    if (this.viewMode === 'available') {
        this.ofertasService.getOfertas().subscribe({
            next: (offers) => {
                console.log('Ofertas cargadas:', offers);
                this.jobOffers = offers;
                this.filterOffers();
            },
            error: (err) => {
                console.error('Error al cargar ofertas:', err);
                this.toastr.error(err.error?.error || 'Error al cargar las ofertas', 'Error');
                if (err.status === 401 || err.status === 403) {
                    this.authService.logout();
                    this.router.navigate(['/login']);
                }
            }
        });
    } else if (this.viewMode === 'admin') {
        this.ofertasService.getAdminOffers().subscribe({
            next: (offers) => {
                console.log('Ofertas con inscritos cargadas:', offers);
                this.jobOffers = offers;
                this.filterOffers();
            },
            error: (err) => {
                console.error('Error al cargar ofertas con inscritos:', err);
                this.toastr.error(err.error?.error || 'Error al cargar las ofertas con inscritos', 'Error');
                if (err.status === 401 || err.status === 403) {
                    this.authService.logout();
                    this.router.navigate(['/login']);
                }
            }
        });
    } else if (this.viewMode === 'applied') {
        const idTrabajador = this.authService.getUser()?.id;
        if (idTrabajador) {
            this.ofertasService.getOfertasAplicadas(idTrabajador).subscribe({
                next: (offers) => {
                    console.log('Ofertas confirmadas cargadas:', offers);
                    this.appliedOffers = offers;
                },
                error: (err) => {
                    console.error('Error al cargar ofertas confirmadas:', err);
                    this.toastr.error(err.error?.error || 'Error al cargar las ofertas confirmadas', 'Error');
                }
            });
        } else {
            this.toastr.error('No se pudo obtener el ID del usuario', 'Error');
        }
    }
}

  filterOffers(): void {
    console.log('Filtro aplicado:', this.offerFilter);
    if (this.offerFilter === 'all') {
      this.filteredOffers = [...this.jobOffers];
    } else if (this.offerFilter === 'open') {
      this.filteredOffers = this.jobOffers.filter(offer => offer.estado === 'open');
    } else if (this.offerFilter === 'closed') {
      this.filteredOffers = this.jobOffers.filter(offer => offer.estado === 'closed');
    }
  }

  loadCalendarEvents(): void {
    const idTrabajador = this.user?.rol === 'trabajador' ? this.user.id : undefined;
    this.ofertasService.getOfertasParaCalendario(idTrabajador).subscribe({
      next: (offers) => {
        console.log('Ofertas para calendario (originales):', offers);
        this.calendarEvents = offers.map(offer => {
          const date = new Date(offer.fecha);
          const normalizedDate = date.toISOString().split('T')[0];
          console.log(`Oferta ${offer.id}: Fecha original=${offer.fecha}, Fecha normalizada=${normalizedDate}, Estado=${offer.estado}, Inscrita=${offer.inscrita}`);
          return {
            title: offer.titulo,
            date: normalizedDate,
            id: offer.id.toString(),
            backgroundColor: offer.estado === 'closed' ? '#F44336' : '#4CAF50',
            borderColor: offer.estado === 'closed' ? '#D32F2F' : '#388E3C'
          };
        });
        this.calendarOptions = {
          ...this.calendarOptions,
          events: this.calendarEvents
        };
        console.log('Eventos del calendario:', this.calendarEvents);
      },
      error: (err) => {
        console.error('Error al cargar eventos del calendario:', err);
        this.toastr.error('Error al cargar eventos del calendario', 'Error');
      }
    });
  }

  handleDateClick(arg: any): void {
    const selectedDate = arg.event.startStr;
    this.filteredOffers = this.jobOffers.filter(offer => {
      const offerDate = new Date(offer.fecha).toISOString().split('T')[0];
      return offerDate === selectedDate;
    });
    if (this.filteredOffers.length === 0) {
      this.toastr.info('No hay ofertas para esta fecha', 'Información');
    }
  }

  selectOffer(offer: JobOffer): void {
    this.selectedOffer = offer;
    this.isLoadingInscriptions = true;
    this.ofertasService.getInscripcionesOferta(offer.id).subscribe({
      next: (inscriptions) => {
        this.inscriptions = inscriptions;
        this.isLoadingInscriptions = false;
      },
      error: (err) => {
        console.error('Error al cargar inscripciones:', err);
        this.toastr.error(err.error?.error || 'Error al cargar las inscripciones', 'Error');
        this.isLoadingInscriptions = false;
      }
    });
  }

  asociarTrabajador(idTrabajador: number, idOferta: number): void {
    this.ofertasService.asociarTrabajadorOferta(idTrabajador, idOferta).subscribe({
      next: () => {
        this.toastr.success('Trabajador asignado correctamente', 'Éxito');
        this.selectOffer(this.selectedOffer!);
        this.loadOffers();
      },
      error: (err) => {
        console.error('Error al asignar trabajador:', err);
        this.toastr.error(err.error?.error || 'Error al asignar el trabajador', 'Error');
      }
    });
  }

  aplicarOferta(idOferta: number): void {
    this.ofertasService.inscribirseOferta(idOferta).subscribe({
      next: () => {
        this.toastr.success('¡Inscripción exitosa!', 'Éxito');
        this.jobOffers = this.jobOffers.map(offer =>
          offer.id === idOferta ? { ...offer, inscrita: true } : offer
        );
        this.filterOffers();
        this.loadCalendarEvents();
      },
      error: (err) => {
        console.error('Error al inscribirse:', err);
        this.toastr.error(err.error?.error || 'Error al inscribirse a la oferta', 'Error');
      }
    });
  }

  desaplicarOferta(idOferta: number): void {
    this.ofertasService.desinscribirseOferta(idOferta).subscribe({
      next: () => {
        this.toastr.success('¡Inscripción eliminada correctamente!', 'Éxito');
        this.appliedOffers = this.appliedOffers.filter(offer => offer.id !== idOferta);
        this.loadOffers();
        this.loadCalendarEvents();
      },
      error: (err) => {
        console.error('Error al desinscribirse:', err);
        this.toastr.error(err.error?.error || 'Error al desinscribirse de la oferta', 'Error');
      }
    });
  }

  loadDocuments(): void {
    this.isLoadingDocuments = true;
    const userId = this.authService.getUser()?.id;
    if (!userId) {
      this.toastr.error('No se pudo obtener el ID del usuario', 'Error');
      this.isLoadingDocuments = false;
      return;
    }
    this.documentService.getDocuments(userId).subscribe({
      next: (documents) => {
        this.documents = documents;
        this.isLoadingDocuments = false;
      },
      error: (err) => {
        console.error('Error al cargar documentos:', err);
        this.toastr.error(err.error?.error || 'Error al cargar los documentos', 'Error');
        this.isLoadingDocuments = false;
        if (err.status === 401 || err.status === 403) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  openModal(): void {
    this.isModalOpen = true;
    if (window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.nuevaOferta = { titulo: '', descripcion: '', fecha: '' };
    document.body.style.overflow = '';
  }

  crearOferta(): void {
    if (!this.nuevaOferta.titulo || !this.nuevaOferta.descripcion || !this.nuevaOferta.fecha) {
      this.toastr.error('Por favor, completa todos los campos', 'Error');
      return;
    }

    this.ofertasService.crearOferta(this.nuevaOferta).subscribe({
      next: () => {
        this.toastr.success('Oferta creada correctamente', 'Éxito');
        this.closeModal();
        this.loadOffers();
        this.loadCalendarEvents();
      },
      error: (err) => {
        console.error('Error al crear oferta:', err);
        this.toastr.error(err.error?.error || 'Error al crear la oferta', 'Error');
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.toastr.error('El archivo no puede ser mayor a 5MB', 'Error');
        return;
      }
      this.selectedFile = file;
    }
  }

  uploadDocument(): void {
    if (!this.selectedFile) {
      this.toastr.error('Por favor, selecciona un documento', 'Error');
      return;
    }

    this.isUploading = true;
    const formData = new FormData();
    formData.append('documento', this.selectedFile);

    this.documentService.uploadDocument(formData).subscribe({
      next: () => {
        this.toastr.success('Documento subido correctamente', 'Éxito');
        this.selectedFile = null;
        this.isUploading = false;
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error al subir documento:', err);
        this.toastr.error(err.error?.error || 'Error al subir el documento', 'Error');
        this.isUploading = false;
      }
    });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  switchToProfile(): void {
    this.viewMode = 'profile';
    this.router.navigate(['/profile']);
    this.loadContent();
  }

  switchToAdmin(): void {
    this.viewMode = 'admin';
    this.router.navigate(['/admin-offers']);
    this.loadContent();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
