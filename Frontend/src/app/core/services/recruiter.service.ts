import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SectorType } from '../models/candidate';

// ── Profil entreprise ─────────────────────────────────────

/** Enum Java CompanySize */
export type CompanySize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  MICRO: '1 à 9 salariés',
  SMALL: '10 à 49 salariés',
  MEDIUM: '50 à 249 salariés',
  LARGE: '250 à 4 999 salariés',
  ENTERPRISE: '5 000 salariés et plus',
};

/** RecruiterDtos.CompanyResponse */
export interface Company {
  id: number;
  name: string;
  description: string | null;
  sector: SectorType;
  size: CompanySize | null;
  city: string | null;
  website: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  createdAt: string;
  /** Offres encore ouvertes */
  activeJobs: number;
}

/** RecruiterDtos.CompanyRequest */
export interface CompanyRequest {
  name: string;
  description: string | null;
  sector: SectorType;
  size: CompanySize | null;
  city: string | null;
  website: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
}

// ── Offres publiées ───────────────────────────────────────

/** Noms de l'enum Java ContractType (une valeur inconnue est enregistrée sans type de contrat) */
export type ContractCode = 'CDI' | 'CDD' | 'INTERIM' | 'STAGE' | 'ALTERNANCE' | 'FREELANCE';

export const CONTRACT_OPTIONS: ReadonlyArray<{ value: ContractCode; label: string }> = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'INTERIM', label: 'Intérim' },
  { value: 'ALTERNANCE', label: 'Alternance' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'FREELANCE', label: 'Freelance' },
];

export function contractLabel(code: string | null | undefined): string {
  return CONTRACT_OPTIONS.find(o => o.value === code)?.label ?? code ?? 'Contrat non précisé';
}

/** RecruiterDtos.RecruiterJobResponse */
export interface RecruiterJob {
  id: number;
  title: string;
  description: string;
  requirements: string | null;
  location: string;
  contractType: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  sector: string | null;
  skills: string[];
  /** 0 = débutant accepté */
  experienceYears: number | null;
  active: boolean;
  createdAt: string;
  applicantsCount: number;
}

/** RecruiterDtos.JobPostRequest (POST /api/recruiter/jobs et PUT /api/recruiter/jobs/{id}) */
export interface JobPostRequest {
  title: string;
  description: string;
  requirements: string | null;
  location: string;
  contractType: ContractCode;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  sector: SectorType;
  skills: string[];
  experienceYears: number | null;
}

// ── Candidats ─────────────────────────────────────────────

/** Statuts visibles par le recruteur (les cartes « à postuler » du candidat restent privées) */
export type ApplicantStatus = 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';

/** Ce que le recruteur peut décider */
export type RecruiterDecision = Exclude<ApplicantStatus, 'APPLIED'>;

export const APPLICANT_STATUS_LABELS: Record<ApplicantStatus, string> = {
  APPLIED: 'Nouvelle',
  INTERVIEW: 'Entretien',
  OFFER: 'Proposition',
  REJECTED: 'Refusée',
};

/** RecruiterDtos.ApplicantResponse */
/** RecruiterDtos.ApplicantResponse */
export interface Applicant {
  applicationId: number;
  candidateId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  city: string | null;
  profileImageUrl: string | null;
  linkedinUrl: string | null;
  sector: SectorType | null;
  yearsOfExperience: number | null;
  skills: string[];
  /** 0 à 100, calculé par le moteur de matching */
  matchScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  status: ApplicantStatus;
  appliedAt: string | null;
  cvUrl: string | null;
  /** Ancienne lettre en texte (candidatures faites avant le formulaire) */
  coverLetter: string | null;
  /** Nom du CV choisi par le candidat */
  cvName: string | null;
  /** Lettre de motivation choisie dans le formulaire (fichier PDF / Word) */
  coverLetterUrl: string | null;
  coverLetterName: string | null;
}

// ── Erreurs ───────────────────────────────────────────────

/** Corps d'erreur renvoyé par RecruiterController : { status, message, fields? } */
export interface RecruiterApiError {
  status: number;
  message: string;
  /** Formulaire invalide : message par champ */
  fields: Record<string, string>;
}

export function toRecruiterError(err: unknown): RecruiterApiError {
  if (err instanceof HttpErrorResponse) {
    const body = (err.error ?? {}) as Partial<RecruiterApiError>;
    if (err.status === 0) {
      return { status: 0, message: 'Serveur injoignable. Vérifiez votre connexion.', fields: {} };
    }
    return {
      status: err.status,
      message: body.message || defaultMessage(err.status),
      fields: body.fields ?? {},
    };
  }
  return { status: -1, message: 'Une erreur inattendue est survenue.', fields: {} };
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401: return 'Votre session a expiré. Reconnectez-vous.';
    case 403: return "Vous n'avez pas accès à cette ressource.";
    case 404: return 'Élément introuvable.';
    case 409: return "Créez d'abord le profil de votre entreprise.";
    default: return 'Une erreur est survenue. Réessayez dans un instant.';
  }
}

// ── Service ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RecruiterService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/recruiter`;

  /** Profil entreprise, ou null s'il n'a pas encore été créé (404) */
  getCompany(): Observable<Company | null> {
    return this.http.get<Company>(`${this.base}/company`).pipe(
      catchError(err => err instanceof HttpErrorResponse && err.status === 404 ? of(null) : throwError(() => err)),
    );
  }

  /** Crée le profil au premier appel, le met à jour ensuite */
  saveCompany(body: CompanyRequest): Observable<Company> {
    return this.http.put<Company>(`${this.base}/company`, body);
  }

  /** Envoie un logo (PNG, JPG ou WebP, 2 Mo max) et renvoie son adresse publique */
  uploadLogo(file: File): Observable<{ url: string }> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/company/logo`, body);
  }

  listJobs(): Observable<RecruiterJob[]> {
    return this.http.get<RecruiterJob[]>(`${this.base}/jobs`);
  }

  getJob(id: number): Observable<RecruiterJob> {
    return this.http.get<RecruiterJob>(`${this.base}/jobs/${id}`);
  }

  createJob(body: JobPostRequest): Observable<RecruiterJob> {
    return this.http.post<RecruiterJob>(`${this.base}/jobs`, body);
  }

  updateJob(id: number, body: JobPostRequest): Observable<RecruiterJob> {
    return this.http.put<RecruiterJob>(`${this.base}/jobs/${id}`, body);
  }

  /** Fermer (active = false) ou rouvrir une offre */
  setJobActive(id: number, active: boolean): Observable<RecruiterJob> {
    return this.http.patch<RecruiterJob>(`${this.base}/jobs/${id}/status`, { active });
  }

  /** Candidatures reçues, de la plus compatible à la moins compatible */
  applicants(jobId: number): Observable<Applicant[]> {
    return this.http.get<Applicant[]>(`${this.base}/jobs/${jobId}/applicants`);
  }

  decide(applicationId: number, status: RecruiterDecision): Observable<Applicant> {
    return this.http.patch<Applicant>(`${this.base}/applications/${applicationId}/status`, { status });
  }
}