import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LoginRequest, RegisterRequest, AuthResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly API_URL = 'http://localhost:8080/api/auth';

  // 👉 safe init (SSR compatible)
  isAuthenticated = signal<boolean>(false);
  userEmail = signal<string | null>(null);

  constructor() {
    // 🔒 check only in browser
    if (typeof window !== 'undefined') {
      this.isAuthenticated.set(!!localStorage.getItem('jwt_token'));
      this.userEmail.set(localStorage.getItem('user_email'));
    }
  }

  // ================= LOGIN =================
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap(response => this.saveAuthData(response))
      );
  }

  // ================= REGISTER =================
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, data)
      .pipe(
        tap(response => this.saveAuthData(response))
      );
  }

  // ================= LOGOUT =================
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_email');
    }

    this.isAuthenticated.set(false);
    this.userEmail.set(null);
    this.router.navigate(['/login']);
  }

  // ================= GET TOKEN =================
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('jwt_token');
  }

  // ================= SAVE DATA =================
  private saveAuthData(response: AuthResponse): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jwt_token', response.token);
      localStorage.setItem('user_email', response.email);
    }

    this.isAuthenticated.set(true);
    this.userEmail.set(response.email);
  }

  // ================= CHECK TOKEN =================
  private hasValidToken(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('jwt_token');
  }
}