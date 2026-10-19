import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CandidateCv {
  id: number;
  title: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  defaultCv: boolean;
  /** Texte déjà extrait du PDF */
  textReady: boolean;
  createdAt: string;
}

export interface CreateCvRequest {
  title: string;
  fileName: string;
  fileUrl: string;
  contentType?: string | null;
  fileSize?: number | null;
  makeDefault?: boolean;
}

export type AdaptationStatus ='TO_APPLY' | 'ACCEPTED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';
/** Réponse de /api/ai/cv-adaptations — AiDtos.CvAdaptationResponse */
export interface CvAdaptation {
  id: number;
  cvId: number;
  cvTitle: string;
  jobOfferId: number;
  /** CV adapté, en Markdown simple (## Titre, - puce) */
  adaptedContent: string;
  keywordsAdded: string[];
  suggestions: string[];
  /** Technologies ajoutées par l'IA sans être dans le CV d'origine : à vérifier */
  unverifiedSkills: string[];
  /** Couverture des technologies de l'offre dans le CV, avant / après (0-100) */
  scoreBefore: number | null;
  scoreAfter: number | null;
  aiModel: string;
  status: AdaptationStatus;
  createdAt: string;
  remainingQuota: number | null;
}


export type LetterTone = 'FORMAL' | 'DYNAMIC';
export type LetterLength = 'SHORT' | 'STANDARD';
export type LetterLanguage = 'FR' | 'EN';

export interface CoverLetterRequest {
  jobOfferId: number;
  cvId?: number | null;
  tone: LetterTone;
  length: LetterLength;
  language: LetterLanguage;
}

export interface CoverLetter {
  subject: string;
  letter: string;
  highlights: string[];
  aiModel: string;
  remainingQuota: number | null;
}


export interface AiQuota {
  limit: number;
  used: number;
  remaining: number;
}

export interface AiError {
  status: number;
  code?: string;
  message: string;
}


@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // ── CV : /api/cvs (CvController) ──────────────────────────

  /** GET /api/cvs — CV du candidat connecté */
  listCvs(): Observable<CandidateCv[]> {
    return this.http.get<CandidateCv[]>(`${this.api}/cvs`);
  }

  /** POST /api/cvs — enregistre un CV (ex. celui du profil) */
  createCv(body: CreateCvRequest): Observable<CandidateCv> {
    return this.http.post<CandidateCv>(`${this.api}/cvs`, body);
  }

  /** PATCH /api/cvs/{id}/default — définit le CV par défaut */
  setDefaultCv(id: number): Observable<CandidateCv> {
    return this.http.patch<CandidateCv>(`${this.api}/cvs/${id}/default`, {});
  }

  /** DELETE /api/cvs/{id} — supprime un CV (204 No Content) */
  deleteCv(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/cvs/${id}`);
  }

  // ── Adaptation de CV : /api/ai/cv-adaptations (AiController) ─

  /** POST /api/ai/cv-adaptations — génère un CV adapté à l'offre */
  adaptCv(jobOfferId: number, cvId?: number | null): Observable<CvAdaptation> {
    return this.http.post<CvAdaptation>(`${this.api}/ai/cv-adaptations`, {
      jobOfferId,
      cvId: cvId ?? null,
    });
  }

  /** GET /api/ai/cv-adaptations?jobOfferId= — adaptations déjà faites pour une offre */
  listAdaptations(jobOfferId: number): Observable<CvAdaptation[]> {
    return this.http.get<CvAdaptation[]>(`${this.api}/ai/cv-adaptations`, {
      params: { jobOfferId },
    });
  }
  setAdaptationStatus(id: number, status: AdaptationStatus): Observable<CvAdaptation> {
    return this.http.patch<CvAdaptation>(`${this.api}/ai/cv-adaptations/${id}/status`, { status });
  }

  // ── Lettre de motivation : /api/ai/cover-letters ──────────

  /** POST /api/ai/cover-letters — génère une lettre de motivation */
  coverLetter(body: CoverLetterRequest): Observable<CoverLetter> {
    return this.http.post<CoverLetter>(`${this.api}/ai/cover-letters`, body);
  }

  // ── Quota : /api/ai/quota ─────────────────────────────────

  /** GET /api/ai/quota — générations restantes aujourd'hui */
  quota(): Observable<AiQuota> {
    return this.http.get<AiQuota>(`${this.api}/ai/quota`);
  }
}