import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Paramètres de l'import France Travail (backend existant : FranceTravailController) */
export interface FranceTravailImportParams {
  /** Mots-clés ; les accents sont retirés (France Travail renvoie 204 sinon) */
  keywords?: string;
  /** Code INSEE de la commune (ex. 45234 pour Orléans), facultatif */
  commune?: string;
  /** Nombre d'offres à importer (30 max conseillé) */
  max?: number;
}

/** Réponse de POST /api/francetravail/import ou /import/sector/{sector} */
export interface FranceTravailImportResult {
  status: string;
  imported: number;
}

@Injectable({ providedIn: 'root' })
export class FranceTravailService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/francetravail`;

  /** POST /api/francetravail/import?motsCles=…&commune=…&max=… */
  importOffers(params: FranceTravailImportParams): Observable<FranceTravailImportResult> {
    let httpParams = new HttpParams().set('max', String(Math.min(30, params.max ?? 30)));
    const motsCles = this.stripAccents(params.keywords);
    if (motsCles) httpParams = httpParams.set('motsCles', motsCles);
    if (params.commune?.trim()) httpParams = httpParams.set('commune', params.commune.trim());

    return this.http.post<FranceTravailImportResult>(`${this.baseUrl}/import`, null, { params: httpParams });
  }

  /** POST /api/francetravail/import/sector/{sector} — utilise le mot-clé du secteur côté backend */
  importBySector(sector: string): Observable<FranceTravailImportResult> {
    return this.http.post<FranceTravailImportResult>(
      `${this.baseUrl}/import/sector/${encodeURIComponent(sector)}`, null);
  }

  /** « Développeur » → « Developpeur » */
  private stripAccents(text?: string): string {
    return (text || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}