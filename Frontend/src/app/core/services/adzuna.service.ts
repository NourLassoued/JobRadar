import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { JobOffer } from './job.service';
import { environment } from '../../../environments/environment';

/** Paramètres de recherche envoyés au backend JobRadar (jamais à Adzuna directement) */
export interface AdzunaSearchParams {
  /** Code pays Adzuna (fr, gb, de…). Absent = pays par défaut du backend (fr) */
  country?: string;
  what?: string;
  where?: string;
  page?: number;
  resultsPerPage?: number;
  /** Code SectorType (TECH, HEALTH…) */
  sector?: string;
}

/** Réponse de GET /api/jobs/adzuna */
export interface AdzunaSearchResult {
  /** Pays effectivement interrogé */
  country: string;
  /** Nombre total d'offres annoncé par Adzuna */
  count: number;
  page: number;
  /** Offres déjà enregistrées dans JobRadar (avec un id), source = 'ADZUNA' */
  offers: JobOffer[];
}

/** Erreur renvoyée par le backend : { source, reason, message } */
export interface AdzunaError {
  reason?: 'NOT_CONFIGURED' | 'UNSUPPORTED_COUNTRY' | 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'BAD_REQUEST' | 'UNAVAILABLE';
  message?: string;
  /** Pays autorisés, renvoyés si le pays demandé est refusé */
  countries?: string[];
}

/** Réponse de GET /api/jobs/adzuna/countries */
export interface AdzunaCountries {
  countries: string[];
  default: string;
}

@Injectable({ providedIn: 'root' })
export class AdzunaService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/jobs/adzuna`;

  search(params: AdzunaSearchParams): Observable<AdzunaSearchResult> {
    let httpParams = new HttpParams();
    if (params.country) httpParams = httpParams.set('country', params.country.toLowerCase());
    // Paramètres vides non envoyés (évite "sector=" que Spring ne sait pas convertir)
    if (params.what?.trim()) httpParams = httpParams.set('what', params.what.trim());
    if (params.where?.trim()) httpParams = httpParams.set('where', params.where.trim());
    if (params.sector) httpParams = httpParams.set('sector', params.sector);
    httpParams = httpParams.set('page', String(params.page ?? 1));
    if (params.resultsPerPage) httpParams = httpParams.set('resultsPerPage', String(params.resultsPerPage));

    return this.http.get<AdzunaSearchResult>(this.baseUrl, { params: httpParams });
  }

  /** Pays disponibles, pour un éventuel sélecteur de pays */
  getCountries(): Observable<AdzunaCountries> {
    return this.http.get<AdzunaCountries>(`${this.baseUrl}/countries`);
  }
}