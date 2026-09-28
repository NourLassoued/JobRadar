import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import { CandidateResponse } from '../models/candidate';

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
        console.log('🔐 Login Response:', res);
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

  /**
   * ✅ NOUVEAU: Récupère l'utilisateur connecté depuis GET /api/auth/me
   * Utilisé après login pour charger les infos complètes
   */
  public getCurrentUserInfo(): Observable<UserResponse> {
    console.log('📥 Fetching current user info from /auth/me');
    
    return this.http.get<UserResponse>(`${this.API}/me`).pipe(
      tap(user => {
        console.log('✅ Current user fetched:', user);
        
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
        console.log('✅ User stored in signal:', this.getCurrentUserId());
      })
    );
  }

  
  public getUserById(id: number): Observable<UserResponse> {
    console.log('📥 Fetching user with ID:', id);
    
    return this.http.get<UserResponse>(`${this.API}/user/${id}`).pipe(
      tap(user => {
        console.log('✅ User fetched:', user);
      })
    );
  }

  logout(): void {
    this.http.post(`${this.API}/logout`, {}).pipe(
      finalize(() => {
        console.log('🔓 Logout - Cleaning localStorage');
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
    console.log('📊 getCurrentUserId() - currentUser:', user);
    console.log('📊 getCurrentUserId() - returning:', user?.id || 0);
    return user?.id || 0;
  }

  public getCurrentUser(): CandidateResponse | null {
    return this.currentUser();
  }

  private storeUser(user: CandidateResponse): void {
    console.log('💾 Storing user to localStorage:', user);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private loadUserFromStorage(): CandidateResponse | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    console.log('📂 Loading user from localStorage:', userJson);
    
    if (!userJson) {
      console.log('❌ No user in localStorage');
      return null;
    }
    
    try {
      const user = JSON.parse(userJson) as CandidateResponse;
      console.log('✅ User loaded from storage:', user);
      return user;
    } catch (e) {
      console.error('❌ Error parsing user from localStorage:', e);
      return null;
    }
  }

  private storeToken(token: string): void {
    console.log('💾 Storing token to localStorage');
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticated.set(true);
  }

  handleOAuthCallback(token: string): void {
    console.log('🔐 OAuth Callback - Step 1: Storing token');
    this.storeToken(token);
    
    console.log('🔐 OAuth Callback - Step 2: Fetching user from /api/auth/me');
    
    setTimeout(() => {
      this.getCurrentUserInfo().subscribe({
        next: () => {
          console.log('✅ Step 3-5: User stored!');
          console.log('🚀 Step 6: Navigating to dashboard');
          this.router.navigate(['/app/dashboard']);
        },
        error: (err) => {
          console.error('❌ Error from /api/auth/me:', err.status, err.message);
          console.log('🚀 Navigating to dashboard anyway');
          this.router.navigate(['/app/dashboard']);
        }
      });
    }, 500);
  }
}