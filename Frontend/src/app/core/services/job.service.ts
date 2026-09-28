import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface JobOffer {
  id: number;
  title: string;
  company: string;
  location: string;
  sector: string;
  contractType: string;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  remote: boolean;
  isActive: boolean;
  createdAt: string;
  url?: string; 
}

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/job-offers`; 

  getAllOffers(): Observable<JobOffer[]> {
    return this.http.get<JobOffer[]>(this.apiUrl);
  }

  getActiveOffers(): Observable<JobOffer[]> {
    return this.http.get<JobOffer[]>(`${this.apiUrl}/active`);
  }

  getRemoteOffers(): Observable<JobOffer[]> {
    return this.http.get<JobOffer[]>(`${this.apiUrl}/remote`);
  }

  getOfferById(id: number): Observable<JobOffer> {
    return this.http.get<JobOffer>(`${this.apiUrl}/${id}`);
  }
}