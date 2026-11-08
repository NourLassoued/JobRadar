import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActivityType, ApplicationStatus } from '../models/application-status';

/** Une carte du Kanban (TrackingDtos.ApplicationCard) */
export interface ApplicationCard {
  id: number;
  jobOfferId: number | null;
  jobTitle: string;
  company: string | null;
  companyLogoUrl: string | null;
  location: string | null;
  contractType: string | null;
  status: ApplicationStatus;
  /** yyyy-MM-dd */
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Prochain entretien / appel / test à venir */
  nextEventAt: string | null;
  nextEventType: ActivityType | null;
  /** Date de relance, yyyy-MM-dd */
  followUpAt: string | null;
  jobUrl: string | null;
  matchScore: number | null;
  /** Offre d'une entreprise JobRadar : le recruteur fait avancer la candidature */
  managedByRecruiter: boolean;
  /** Colonnes vers lesquelles la carte peut être déplacée */
  allowedMoves: ApplicationStatus[];
}

export interface OfferInfo {
  description: string | null;
  requirements: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  remote: boolean | null;
  sector: string | null;
  source: string | null;
  active: boolean;
  publishedAt: string | null;
}

export interface ApplicationDocuments {
  cvName: string | null;
  cvUrl: string | null;
  coverLetterName: string | null;
  coverLetterUrl: string | null;
  coverLetterText: string | null;
}

export interface RecruiterContact {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export interface NoteItem {
  id: number;
  content: string;
  createdAt: string;
}

export interface ActivityItem {
  id: number;
  type: ActivityType;
  title: string;
  scheduledAt: string;
  location: string | null;
  details: string | null;
  done: boolean;
}

export interface HistoryItem {
  id: number;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  message: string | null;
  /** CANDIDATE, RECRUITER, ADMIN ou SYSTEM */
  actorRole: string;
  createdAt: string;
}

export interface ApplicationDetail {
  card: ApplicationCard;
  offer: OfferInfo | null;
  documents: ApplicationDocuments;
  contact: RecruiterContact;
  notes: NoteItem[];
  activities: ActivityItem[];
  history: HistoryItem[];
}

export interface ApplicationStats {
  total: number;
  sent: number;
  interviews: number;
  offers: number;
  rejected: number;
  withdrawn: number;
  /** % ou null si aucune candidature envoyée */
  applicationToInterviewRate: number | null;
  interviewToOfferRate: number | null;
}

export interface CreateApplicationRequest {
  jobOfferId?: number | null;
  jobTitle?: string | null;
  company?: string | null;
  jobUrl?: string | null;
  location?: string | null;
  contractType?: string | null;
  status?: ApplicationStatus | null;
  appliedAt?: string | null;
}

export interface UpdateApplicationRequest {
  jobTitle?: string | null;
  company?: string | null;
  jobUrl?: string | null;
  location?: string | null;
  contractType?: string | null;
  appliedAt?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface ActivityRequest {
  type: ActivityType;
  title: string;
  /** yyyy-MM-ddTHH:mm */
  scheduledAt: string;
  location?: string | null;
  details?: string | null;
}

/**
 * Suivi des candidatures du candidat connecté (Kanban).
 * Le backend ne renvoie que les candidatures du candidat (JWT ajouté par l'intercepteur).
 */
@Injectable({ providedIn: 'root' })
export class ApplicationTrackingService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/tracking/applications`;

  board(): Observable<ApplicationCard[]> {
    return this.http.get<ApplicationCard[]>(this.base);
  }

  stats(): Observable<ApplicationStats> {
    return this.http.get<ApplicationStats>(`${this.base}/stats`);
  }

  detail(id: number): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${this.base}/${id}`);
  }

  create(body: CreateApplicationRequest): Observable<ApplicationCard> {
    return this.http.post<ApplicationCard>(this.base, body);
  }

  update(id: number, body: UpdateApplicationRequest): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`${this.base}/${id}`, body);
  }

  move(id: number, status: ApplicationStatus): Observable<ApplicationCard> {
    return this.http.patch<ApplicationCard>(`${this.base}/${id}/status`, { status });
  }

  setFollowUp(id: number, followUpAt: string | null): Observable<ApplicationDetail> {
    return this.http.put<ApplicationDetail>(`${this.base}/${id}/follow-up`, { followUpAt });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addNote(id: number, content: string): Observable<NoteItem> {
    return this.http.post<NoteItem>(`${this.base}/${id}/notes`, { content });
  }

  deleteNote(id: number, noteId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/notes/${noteId}`);
  }

  addActivity(id: number, body: ActivityRequest): Observable<ActivityItem> {
    return this.http.post<ActivityItem>(`${this.base}/${id}/activities`, body);
  }

  setActivityDone(id: number, activityId: number, done: boolean): Observable<ActivityItem> {
    return this.http.patch<ActivityItem>(`${this.base}/${id}/activities/${activityId}`, { done });
  }

  deleteActivity(id: number, activityId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/activities/${activityId}`);
  }

  /** Message lisible d'une erreur d'API ({ status, message } côté backend) */
  static errorMessage(err: unknown, fallback = 'Une erreur est survenue. Réessayez.'): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Le serveur JobRadar ne répond pas. Vérifiez votre connexion.';
      if (err.status === 401) return 'Votre session a expiré : reconnectez-vous.';
      const message = (err.error as { message?: string } | null)?.message;
      if (message) return message;
    }
    return fallback;
  }
}
