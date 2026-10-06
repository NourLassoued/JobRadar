import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('jr_token');

  if (token && token.trim().length > 0) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error) => {
      console.error('[INTERCEPTOR] HTTP Error:', error.status);

      if (error.status === 401) {
        localStorage.removeItem('jr_token');
        localStorage.removeItem('jr_user');
        router.navigate(['/auth/login']);
      }

      return throwError(() => error);
    })
  );
};