import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JobOffer } from './job.service';

export interface TheMuseSearchParams {
  keywords?: string;
  location?: string;
  page?: number;
  resultsPerPage?: number;
  sector?: string;
}

export interface TheMuseSearchResult {
  count: number;
  page: number;
  pagesRead: number;
  hasMore: boolean;
  offers: JobOffer[];
}

@Injectable({ providedIn: 'root' })
export class TheMuseService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/jobs/themuse`;

  search(params: TheMuseSearchParams): Observable<TheMuseSearchResult> {
    let httpParams = new HttpParams();
    if (params.keywords?.trim()) httpParams = httpParams.set('keywords', params.keywords.trim());
    if (params.location?.trim()) httpParams = httpParams.set('location', params.location.trim());
    if (params.sector) httpParams = httpParams.set('sector', params.sector);
    httpParams = httpParams.set('page', String(params.page ?? 1));
    if (params.resultsPerPage) httpParams = httpParams.set('resultsPerPage', String(Math.min(40, params.resultsPerPage)));

    return this.http.get<TheMuseSearchResult>(this.baseUrl, { params: httpParams });
  }
}