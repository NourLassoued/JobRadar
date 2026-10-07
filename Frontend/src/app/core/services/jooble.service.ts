import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JobOffer } from './job.service';

/** Paramètres envoyés au backend JobRadar (jamais à Jooble directement) */
export interface JoobleSearchParams {
  keywords?: string;
  /** Lieu (ex. « Orléans ») ; absent = « France » côté backend */
  location?: string;
  page?: number;
  resultsPerPage?: number;
  /** Code SectorType (TECH, HEALTH…) */
  sector?: string;
}

/** Réponse de GET /api/jobs/jooble */
export interface JoobleSearchResult {
  count: number;
  page: number;
  /** Offres enregistrées dans JobRadar (avec un id), source = 'JOOBLE' */
  offers: JobOffer[];
}

/** Erreur renvoyée par le backend : { source, reason, message } */
export interface JoobleError {
  reason?: 'NOT_CONFIGURED' | 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'BAD_REQUEST' | 'UNAVAILABLE';
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class JoobleService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/jobs/jooble`;

  search(params: JoobleSearchParams): Observable<JoobleSearchResult> {
    let httpParams = new HttpParams();
    if (params.keywords?.trim()) httpParams = httpParams.set('keywords', params.keywords.trim());
    if (params.location?.trim()) httpParams = httpParams.set('location', params.location.trim());
    if (params.sector) httpParams = httpParams.set('sector', params.sector);
    httpParams = httpParams.set('page', String(params.page ?? 1));
    if (params.resultsPerPage) httpParams = httpParams.set('resultsPerPage', String(params.resultsPerPage));

    return this.http.get<JoobleSearchResult>(this.baseUrl, { params: httpParams });
  }
}