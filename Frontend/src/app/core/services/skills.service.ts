import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Un secteur renvoyé par GET /api/sectors */
export interface SectorInfo {
  code: string;        // TECH, HEALTH… (enum Java SectorType)
  label: string;       // « Informatique / Tech »
  skillCount: number;
}

/**
 * Compétences proposées par secteur.
 * Source unique : le backend (SectorSkillsCatalog.java).
 * Chaque secteur n'est demandé qu'une fois, puis gardé en cache.
 */
@Injectable({ providedIn: 'root' })
export class SectorService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/sectors`;

  /** Cache : un Observable partagé par code secteur */
  private readonly skillsCache = new Map<string, Observable<string[]>>();
  private sectors$?: Observable<SectorInfo[]>;

  /** GET /api/sectors/{code}/skills — liste vide si erreur ou secteur inconnu */
  getSectorSkills(sector: string): Observable<string[]> {
    const code = (sector || '').trim().toUpperCase();
    if (!code) return of([]);

    let request$ = this.skillsCache.get(code);
    if (!request$) {
      request$ = this.http.get<string[]>(`${this.baseUrl}/${encodeURIComponent(code)}/skills`).pipe(
        map(list => (Array.isArray(list) ? list : [])),
        catchError(err => {
          console.error(`Compétences du secteur ${code} indisponibles :`, err);
          this.skillsCache.delete(code); // on réessaiera au prochain appel
          return of<string[]>([]);
        }),
        shareReplay(1),
      );
      this.skillsCache.set(code, request$);
    }
    return request$;
  }

  /** GET /api/sectors — tous les secteurs avec leur libellé et nombre de compétences */
  getSectors(): Observable<SectorInfo[]> {
    if (!this.sectors$) {
      this.sectors$ = this.http.get<SectorInfo[]>(this.baseUrl).pipe(
        catchError(err => {
          console.error('Liste des secteurs indisponible :', err);
          this.sectors$ = undefined;
          return of<SectorInfo[]>([]);
        }),
        shareReplay(1),
      );
    }
    return this.sectors$;
  }

  /**
   * POST /api/sectors/{code}/skills/validate
   * Indique quelles compétences ne font pas partie du secteur (les personnalisées restent permises).
   */
  validateSkills(sector: string, skills: string[]): Observable<{ valid: boolean; unknownSkills: string[] }> {
    const code = (sector || '').trim().toUpperCase();
    return this.http
      .post<{ valid: boolean; unknownSkills: string[] }>(`${this.baseUrl}/${encodeURIComponent(code)}/skills/validate`, skills)
      .pipe(catchError(() => of({ valid: true, unknownSkills: [] })));
  }
}