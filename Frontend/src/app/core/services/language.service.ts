import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FALLBACK_LANGUAGE_REFERENCE, LanguageReference } from '../models/Language';

/** Référentiel des langues et niveaux (GET /api/languages), chargé une seule fois. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private http = inject(HttpClient);

  private readonly reference$: Observable<LanguageReference> = this.http
    .get<LanguageReference>(`${environment.apiUrl}/languages`)
    .pipe(
      catchError(err => {
        console.error('Référentiel des langues indisponible, valeurs de secours utilisées :', err);
        return of(FALLBACK_LANGUAGE_REFERENCE);
      }),
      shareReplay(1),
    );

  getReference(): Observable<LanguageReference> {
    return this.reference$;
  }
}