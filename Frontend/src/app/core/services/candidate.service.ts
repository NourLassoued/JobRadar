import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CandidateRequest, CandidateResponse, SectorType } from '../models/candidate';
// ✅ N'oublie pas les imports!
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CandidateService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/candidates`;

  // ===== CREATE / READ =====
  createCandidate(request: CandidateRequest): Observable<CandidateResponse> {
    return this.http.post<CandidateResponse>(this.apiUrl, request);
  }

  getAllCandidates(): Observable<CandidateResponse[]> {
    return this.http.get<CandidateResponse[]>(this.apiUrl);
  }

  getCandidateById(id: number): Observable<CandidateResponse> {
    return this.http.get<CandidateResponse>(`${this.apiUrl}/${id}`);
  }

  getActiveCandidates(): Observable<CandidateResponse[]> {
    return this.http.get<CandidateResponse[]>(`${this.apiUrl}/active`);
  }

  getCandidatesBySector(sector: SectorType): Observable<CandidateResponse[]> {
    return this.http.get<CandidateResponse[]>(this.apiUrl, {
      params: { sector }
    });
  }

  getCandidatesByCity(city: string): Observable<CandidateResponse[]> {
    return this.http.get<CandidateResponse[]>(this.apiUrl, {
      params: { city }
    });
  }

  // ===== UPDATE / DELETE =====
  updateCandidate(id: number, request: CandidateRequest): Observable<CandidateResponse> {
    return this.http.put<CandidateResponse>(`${this.apiUrl}/${id}`, request);
  }

  deleteCandidate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  archiveCandidate(id: number): Observable<CandidateResponse> {
    return this.http.patch<CandidateResponse>(`${this.apiUrl}/${id}/archive`, {});
  }

  // ===== FILE UPLOAD - SUPABASE STORAGE =====

  /**
   * Upload image de profil seule (multipart)
   * Backend: POST /api/candidates/{id}/profile-image
   */
  uploadProfileImage(id: number, file: File): Observable<CandidateResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<CandidateResponse>(
      `${this.apiUrl}/${id}/profile-image`,
      formData
    );
  }

  /**
   * Upload CV seul (multipart)
   * Backend: POST /api/candidates/{id}/cv
   */
  uploadCV(id: number, file: File): Observable<CandidateResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<CandidateResponse>(
      `${this.apiUrl}/${id}/cv`,
      formData
    );
  }

  /**
   * Upload image + CV ensemble (multipart)
   * Backend: POST /api/candidates/{id}/media
   */
  uploadMediaFiles(
    id: number,
    profileImage?: File,
    cv?: File
  ): Observable<CandidateResponse> {
    const formData = new FormData();
    if (profileImage) {
      formData.append('profileImage', profileImage);
    }
    if (cv) {
      formData.append('cv', cv);
    }
    return this.http.post<CandidateResponse>(
      `${this.apiUrl}/${id}/media`,
      formData
    );
  }

  /**
   * ✅ SIMPLIFIÉ — Upload + Update en 2 requêtes séparées
   * 
   * Workflow:
   * 1. PUT /api/candidates/{id} — Update les données
   * 2. POST /api/candidates/{id}/media — Upload les files
   * 
   * Cela évite les problèmes de sérialisation JSON+multipart
   */
  uploadAndUpdateProfile(
    id: number,
    request: CandidateRequest,
    profileImage?: File,
    cv?: File
  ): Observable<CandidateResponse> {
    // ✅ OPTION 1: Approche simple — Update puis Upload
    // Plus robuste, mais 2 requêtes
    return this.updateCandidate(id, request).pipe(
      // Puis upload les fichiers (si y en a)
      switchMap((updatedCandidate) => {
        if (!profileImage && !cv) {
          // Pas de fichiers → retourner le candidat update
          return of(updatedCandidate);
        }

        // Y a des fichiers → les upload
        return this.uploadMediaFiles(id, profileImage, cv);
      })
    );
  }

  
  parseSkills(skills?: string): string[] {
    if (!skills) return [];
    try {
      // Try to parse as JSON
      return JSON.parse(skills);
    } catch {
      // Fallback to comma-separated
      return skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
  }

  /**
   * Format skills array to JSON string for API
   */
  formatSkills(skills: string[]): string {
    return JSON.stringify(skills);
  }

  // ===== FILE VALIDATION =====

  /**
   * Valide le type et la taille de fichier image
   * Accepté: JPEG, PNG, GIF, WebP max 5MB
   */
  isValidImageFile(file: File): { valid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      return { valid: false, error: 'Format image invalide (JPEG, PNG, GIF, WebP acceptés)' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Fichier trop volumineux (max 5MB)' };
    }

    return { valid: true };
  }

  /**
   * Valide le type et la taille de fichier CV
   * Accepté: PDF, DOC, DOCX, TXT max 10MB
   */
  isValidCVFile(file: File): { valid: boolean; error?: string } {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      return { valid: false, error: 'Format CV invalide (PDF, DOC, DOCX, TXT acceptés)' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Fichier trop volumineux (max 10MB)' };
    }

    return { valid: true };
  }

  /**
   * Génère une URL de preview pour les images
   */
  getImagePreviewUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extrait le nom du fichier sans extension
   */
  getFileNameWithoutExtension(file: File): string {
    return file.name.split('.')[0];
  }
}

