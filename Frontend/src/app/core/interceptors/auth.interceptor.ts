import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('jr_token');

  console.log('🔍 [INTERCEPTOR] URL:', req.url);
  console.log('🔍 [INTERCEPTOR] Token exists?', !!token);

  if (token && token.trim().length > 0) {
    console.log('[INTERCEPTOR] Adding Authorization header');
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error) => {
      console.error('❌ [INTERCEPTOR] HTTP Error:', error.status);

      if (error.status === 401) {
        console.log('🔓 401 Unauthorized - Logging out');
        localStorage.removeItem('jr_token');
        localStorage.removeItem('jr_user');
        router.navigate(['/auth/login']);
      }

      return throwError(() => error);
    })
  );
};