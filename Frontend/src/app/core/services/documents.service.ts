import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** DocumentDtos.UploadedFileResponse : fichier envoyé, à enregistrer ensuite avec POST /api/cvs */
export interface UploadedFile {
  fileUrl: string;
  fileName: string;
  contentType: string | null;
  fileSize: number;
}

/** DocumentDtos.CoverLetterResponse : lettre de motivation enregistrée */
export interface SavedCoverLetter {
  id: number;
  title: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
}

/** Formats acceptés pour un CV ou une lettre (même liste que le backend) */
export const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,' + DOCUMENT_TYPES.join(',');
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/** Documents de candidature du candidat connecté : /api/documents (DocumentController) */
@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/documents`;

  /** POST /api/documents/cv-file : envoie le fichier d'un nouveau CV */
  uploadCvFile(file: File): Observable<UploadedFile> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<UploadedFile>(`${this.base}/cv-file`, body);
  }

  /** GET /api/documents/cover-letters */
  listCoverLetters(): Observable<SavedCoverLetter[]> {
    return this.http.get<SavedCoverLetter[]>(`${this.base}/cover-letters`);
  }

  /** POST /api/documents/cover-letters : envoie et enregistre une nouvelle lettre */
  uploadCoverLetter(file: File, title?: string): Observable<SavedCoverLetter> {
    const body = new FormData();
    body.append('file', file);
    if (title?.trim()) body.append('title', title.trim());
    return this.http.post<SavedCoverLetter>(`${this.base}/cover-letters`, body);
  }
}

/** Vérification avant envoi : renvoie un message d'erreur, ou null si le fichier convient */
export function checkDocument(file: File): string | null {
  const name = file.name.toLowerCase();
  const okType = DOCUMENT_TYPES.includes(file.type) || /\.(pdf|docx?)$/.test(name);
  if (!okType) return 'Format non accepté : envoyez un PDF ou un document Word (.doc, .docx).';
  if (file.size > DOCUMENT_MAX_BYTES) return 'Fichier trop volumineux (5 Mo maximum).';
  if (file.size === 0) return 'Ce fichier est vide.';
  return null;
}
