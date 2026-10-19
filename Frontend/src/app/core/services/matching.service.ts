import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Résultat du matching renvoyé par le backend (MatchResult.java) */
export interface MatchResult {
  offerId: number;
  title: string;
  company: string;
  /** Score global de 0 à 100 */
  score: number;
  skillsScore: number;
  experienceScore: number;
  sectorScore: number;
  /** Compétences du candidat trouvées dans l'offre */
  matchedSkills: string[];
  /** Technologies repérées dans l'offre */
  offerSkills?: string[];
  /** Technologies de l'offre absentes du profil */
  missingSkills?: string[];
  requiredYears: number | null;
  strategy: string;
  reasons: string[];
}

@Injectable({ providedIn: 'root' })
export class MatchingService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/matching`;

  /** POST /api/matching/offers/scores — scores de plusieurs offres (100 max par appel) */
  scoreOffers(offerIds: number[]): Observable<MatchResult[]> {
    return this.http.post<MatchResult[]>(`${this.baseUrl}/offers/scores`, offerIds.slice(0, 100));
  }

  /** GET /api/matching/offers/{id} — score détaillé d'une offre */
  scoreOffer(offerId: number): Observable<MatchResult> {
    return this.http.get<MatchResult>(`${this.baseUrl}/offers/${offerId}`);
  }

  /** GET /api/matching/top?limit=10 — meilleures offres du candidat */
  topMatches(limit = 10): Observable<MatchResult[]> {
    return this.http.get<MatchResult[]>(`${this.baseUrl}/top`, { params: { limit } });
  }
}