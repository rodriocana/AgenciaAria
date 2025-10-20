import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // Añade esto
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(), // Habilita animaciones para ngx-toastr
    provideToastr({
      timeOut: 5000, // Duración de los toasts en milisegundos
      positionClass: 'toast-top-right', // Posición de los toasts
      preventDuplicates: true, // Evita toasts duplicados
      progressBar: true // Muestra barra de progreso
    })
  ]
};
