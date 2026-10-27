import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import { CandidateResponse } from '../models/candidate';

/**
 * Rôle choisi sur la page d'inscription, gardé pendant l'aller-retour Google/LinkedIn.
 * Écrit par register.component.ts, lu par handleOAuthCallback().
 */
export const SIGNUP_ROLE_KEY = 'jr.signupRole';

/** Page d'arrivée selon le rôle */
export function homeForRole(role: string | null | undefined): string {
  return role === 'RECRUITER' ? '/app/recruteur' : '/app/dashboard';
}

export interface UserResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: string;
  provider?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly API = `${environment.apiUrl}/auth`;
  private readonly BACKEND_BASE = environment.apiUrl.replace('/api', '');
  private readonly TOKEN_KEY = 'jr_token';
  private readonly USER_KEY = 'jr_user';

  private currentUser = signal<CandidateResponse | null>(this.loadUserFromStorage());
  isAuthenticated = signal<boolean>(!!this.getToken());

 
  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, payload).pipe(
      tap(res => {
        this.storeToken(res.token);
        
        if (res.id) {
          const user: CandidateResponse = {
            id: res.id,
            firstName: res.firstName,
            lastName: res.lastName,
            email: res.email,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.currentUser.set(user);
          this.storeUser(user);
        }
      }),
    );
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, payload).pipe(
      tap(res => {
        this.storeToken(res.token);
        
        if (res.id) {
          const user: CandidateResponse = {
            id: res.id,
            firstName: res.firstName,
            lastName: res.lastName,
            email: res.email,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
         
          this.currentUser.set(user);
          this.storeUser(user);
        }
      }),
    );
  }

  loginWithGoogle(): void {
    window.location.href = `${this.BACKEND_BASE}/oauth2/authorization/google?prompt=login`;
  }

  loginWithLinkedIn(): void {
    window.location.href = `${this.BACKEND_BASE}/oauth2/authorization/linkedin?prompt=login`;
  }


  
  public getUserById(id: number): Observable<UserResponse> {
    
    return this.http.get<UserResponse>(`${this.API}/user/${id}`).pipe(
      tap(user => {
      })
    );
  }

  logout(): void {
    this.http.post(`${this.API}/logout`, {}).pipe(
      finalize(() => {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.router.navigate(['/auth/login']);
      })
    ).subscribe();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  public getCurrentUserId(): number {
    const user = this.currentUser();
   
    return user?.id || 0;
  }

  public getCurrentUser(): CandidateResponse | null {
    return this.currentUser();
  }

  private storeUser(user: CandidateResponse): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private loadUserFromStorage(): CandidateResponse | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    
    if (!userJson) {
      console.log(' No user in localStorage');
      return null;
    }
    
    try {
      const user = JSON.parse(userJson) as CandidateResponse;
      return user;
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return null;
    }
  }

  private storeToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticated.set(true);
  }

  /**
   * Retour de Google/LinkedIn (/auth/callback?token=...).
   * Si l'utilisateur avait choisi « Recruteur » avant de partir, on convertit son compte
   * puis on l'envoie créer son profil entreprise. Sinon : page d'accueil selon son rôle.
   */
  handleOAuthCallback(token: string): void {
    this.storeToken(token);

    let wanted: string | null = null;
    try {
      wanted = sessionStorage.getItem(SIGNUP_ROLE_KEY);
      sessionStorage.removeItem(SIGNUP_ROLE_KEY);
    } catch { /* navigation privée */ }

    setTimeout(() => {
      if (wanted === 'RECRUITER') {
        this.becomeRecruiter().subscribe({
          next: () => this.loadUserThenGo('/app/recruteur/entreprise'),
          error: err => {
            console.error(' Error from /api/auth/become-recruiter:', err.status, err.message);
            this.loadUserThenGo(null);
          },
        });
      } else {
        this.loadUserThenGo(null);
      }
    }, 500);
  }

  /** Charge /api/auth/me puis navigue (vers `target`, ou selon le rôle si null) */
  private loadUserThenGo(target: string | null): void {
    this.getCurrentUserInfo().subscribe({
      next: user => this.router.navigate([target ?? homeForRole(user.role)]),
      error: err => {
        console.error(' Error from /api/auth/me:', err.status, err.message);
        this.router.navigate([target ?? '/app/dashboard']);
      },
    });
  }

  forgotPassword(email: string): Observable<any> {
    
    return this.http.post<any>(
      `${this.API}/forgot-password`,
      { email },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
      })
    );
  }

  /**
   * Reset password with token
   */
  resetPassword(token: string, newPassword: string): Observable<any> {
    
    return this.http.post<any>(
      `${this.API}/reset-password`,
      { token, newPassword },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
      })
    );
  }

  /**
   * Validate reset token
   */
  validateResetToken(token: string): Observable<any> {
    
    return this.http.get<any>(
      `${this.API}/validate-reset-token?token=${token}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Change password (for logged in users)
   */
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    
    return this.http.post<any>(
      `${this.API}/change-password`,
      { currentPassword, newPassword },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        console.log(' Password changed successfully');
      })
    );
  }

  /**
   * Helper: Get headers with token
   */
  private getHeaders(): any {
    const token = this.getToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      'Content-Type': 'application/json'
    };
  }

public getCurrentUserInfo(): Observable<UserResponse> {
  
  //  FIX: Add headers with Bearer token!
  return this.http.get<UserResponse>(`${this.API}/me`, {
    headers: this.getHeaders()  // ← C'ÉTAIT MANQUANT!
  }).pipe(
    tap(user => {
      
      // Convertir UserResponse → CandidateResponse
      const candidate: CandidateResponse = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: true,
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.createdAt || new Date().toISOString()
      };
      
      this.currentUser.set(candidate);
      this.storeUser(candidate);
    })
  );
}
  /** Passe le compte connecté en RECRUITER et enregistre le nouveau token (qui contient le rôle) */
  becomeRecruiter(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/become-recruiter`, {}, {
      headers: this.getHeaders(),
    }).pipe(
      tap(res => this.storeToken(res.token)),
    );
  }
    /**
   * Rôle de l'utilisateur connecté (USER, RECRUITER, ADMIN), lu dans le JWT.
   * Le token est remplacé par becomeRecruiter(), donc le rôle suit sans recharger la page.
   */
  getRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return (JSON.parse(atob(payload)) as { role?: string }).role ?? null;
    } catch {
      return null;
    }
  }

  isRecruiter(): boolean {
    return this.getRole() === 'RECRUITER';
  }
}