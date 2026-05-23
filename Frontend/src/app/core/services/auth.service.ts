import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly API = `${environment.apiUrl}/auth`;
  private readonly BACKEND_BASE = environment.apiUrl.replace('/api', '');
  private readonly TOKEN_KEY = 'jr_token';

  isAuthenticated = signal<boolean>(!!this.getToken());

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, payload).pipe(
      tap(res => this.storeToken(res.token)),
    );
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, payload).pipe(
      tap(res => this.storeToken(res.token)),
    );
  }

  // OAuth2 : redirection vers le backend qui gère le flow
  loginWithGoogle(): void {
    window.location.href = `${this.BACKEND_BASE}/oauth2/authorization/google`;
  }

  loginWithLinkedIn(): void {
    window.location.href = `${this.BACKEND_BASE}/oauth2/authorization/linkedin`;
  }

  // Appelé sur la page de callback après redirection OAuth
  handleOAuthCallback(token: string): void {
    this.storeToken(token);
    this.router.navigate(['/app/dashboard']);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private storeToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticated.set(true);
  }
}