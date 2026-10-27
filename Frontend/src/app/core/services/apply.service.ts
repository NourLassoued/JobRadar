import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** ApplyDtos.ApplyRequest : les deux documents sont obligatoires */
export interface ApplyRequest {
  jobOfferId: number;
  /** CV choisi par le candidat (GET /api/cvs) */
  cvId: number;
  /** Lettre choisie par le candidat (GET /api/documents/cover-letters) */
  coverLetterId: number;
}

/** ApplyDtos.ApplyResponse */
export interface ApplyResponse {
  applicationId: number;
  jobOfferId: number;
  jobTitle: string;
  company: string;
  status: 'APPLIED';
  matchScore: number | null;
  appliedAt: string;
}

/** Côté candidat : postuler à une offre publiée par un recruteur JobRadar */
@Injectable({ providedIn: 'root' })
export class ApplyService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/applications`;

  /** POST /api/applications/apply */
  apply(body: ApplyRequest): Observable<ApplyResponse> {
    return this.http.post<ApplyResponse>(`${this.base}/apply`, body);
  }

  /** GET /api/applications/applied-ids : offres auxquelles le candidat a déjà postulé */
  appliedOfferIds(): Observable<number[]> {
    return this.http.get<number[]>(`${this.base}/applied-ids`);
  }
}
