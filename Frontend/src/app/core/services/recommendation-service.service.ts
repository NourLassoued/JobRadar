import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JobOffer } from './job.service';
import { MatchResult } from './matching.service';

/** Offre recommandée : une offre normale + son score de matching */
export type RecommendedOffer = JobOffer & {
  /** Score global de 0 à 100 */
  score: number;
  /** Détail du score (critères, compétences communes, à renforcer…) */
  match: MatchResult;
};

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/jobs/recommended`;

  /**
   * GET /api/jobs/recommended — offres du secteur du candidat connecté
   * (toutes si aucun secteur), déjà triées par score décroissant.
   *
   * @param limit nombre maximum d'offres (facultatif : toutes par défaut)
   */
  getRecommended(limit?: number): Observable<RecommendedOffer[]> {
    const params: Record<string, number> = limit ? { limit } : {};
    return this.http.get<RecommendedOffer[]>(this.url, { params });
  }
}