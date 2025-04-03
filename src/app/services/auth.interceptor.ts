import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, catchError, throwError, switchMap } from 'rxjs';
import { AppComponent } from '../app.component';
import { HttpClient } from '@angular/common/http';

export function jwtInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  
  console.log("Dentro del interceptador");

  const token = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const http = inject(HttpClient); // Para realizar solicitudes HTTP
 console.log("Token:", token);
  console.log("Refresh Token:", refreshToken);
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
let isRefreshing = false; // Variable para controlar el estado de renovación del token
  return next(req).pipe(
    catchError((error): Observable<HttpEvent<unknown>> => {
      console.log("Error en la petición:", error);

      if (error.status === 401 && refreshToken && !isRefreshing) {
        isRefreshing = true; // Marcar que se está renovando el token
        // Intentar renovar el Access Token usando el Refresh Token
        console.error('Access Token expirado. Renovando...');
        return http.post<any>('http://localhost:9000/api/auth/refresh', { refreshToken }).pipe(
          
          switchMap((response: { token: string; refreshToken: string }) => {
            console.log('Nuevo Access Token recibido:', response.token);
            isRefreshing = false; // Restablecer el estado de renovación
            // Guardar el nuevo Access Token y Refresh Token
            localStorage.setItem('access_token', response.token);
            localStorage.setItem('refresh_token', response.refreshToken);

            // Reintentar la solicitud original con el nuevo Access Token
            req = req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.token}`
              }
            });
            return next(req);
          }),
          catchError((refreshError) => {
            console.error('Error al renovar el Access Token ooooooooooooooo:', refreshError);
            isRefreshing = false; // Restablecer el estado de renovación
            // Manejar el caso de Refresh Token caducado
            if (refreshError.status === 401 || refreshError.status === 403) {
              console.error('El Refresh Token ha caducado o es inválido.');
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              toastr.error(
                'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
                'Sesión Expirada',
                {
                  timeOut: 3000,
                  closeButton: true
                }
              );
              router.navigate(['/login']); // Redirigir al usuario al login
            }

            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
}