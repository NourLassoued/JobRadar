import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SectorType } from '../models/candidate';

// ── 8. Résumé IA d'un candidat : RecruiterAiDtos.ApplicantInsight ──

export interface InsightQuestion {
  question: string;
  /** Ce que la question permet de vérifier */
  purpose: string;
}

export interface ApplicantInsight {
  applicationId: number;
  summary: string;
  strengths: string[];
  /** Point à vérifier en entretien (jamais un motif de rejet) */
  watchPoint: string | null;
  questions: InsightQuestion[];
  /** false : le CV n'a pas pu être lu, résumé fait sur le profil seul */
  cvUsed: boolean;
  aiModel: string;
  cached: boolean;
  remainingQuota: number | null;
}

// ── 9. Rédaction d'offre assistée : RecruiterAiDtos.JobDraft ──

export interface JobDraftRequest {
  brief: string;
  title?: string | null;
  contractType?: string | null;
  location?: string | null;
  remote?: boolean | null;
  sector?: SectorType | null;
  experienceYears?: number | null;
}

export interface JobDraft {
  title: string;
  description: string;
  requirements: string;
  skills: string[];
  experienceYears: number | null;
  suggestedSector: SectorType | null;
  tips: string[];
  aiModel: string;
  remainingQuota: number | null;
}

@Injectable({ providedIn: 'root' })
export class RecruiterAiService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/recruiter`;

  /** POST /api/recruiter/applications/{id}/ai-insight */
  applicantInsight(applicationId: number): Observable<ApplicantInsight> {
    return this.http.post<ApplicantInsight>(`${this.base}/applications/${applicationId}/ai-insight`, {});
  }

  /** POST /api/recruiter/ai/job-drafts */
  jobDraft(request: JobDraftRequest): Observable<JobDraft> {
    return this.http.post<JobDraft>(`${this.base}/ai/job-drafts`, request);
  }
}
