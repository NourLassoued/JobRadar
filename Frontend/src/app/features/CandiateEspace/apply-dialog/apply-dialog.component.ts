import {
  afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, switchMap } from 'rxjs';
import { AiService, CandidateCv } from '../../../core/services/ai.service';
import { ApplyService } from '../../../core/services/apply.service';
import {
  checkDocument, DOCUMENT_ACCEPT, DocumentsService, SavedCoverLetter,
} from '../../../core/services/documents.service';

/** Ce dont le formulaire a besoin dans l'offre (compatible avec JobOffer) */
export interface ApplyDialogOffer {
  id: number;
  title: string;
  company?: string | null;
}

/** Résultat envoyé au parent : la carte passe à « Candidature envoyée » */
export interface ApplyDialogResult {
  jobOfferId: number;
  matchScore: number | null;
  /** Le candidat avait déjà postulé à cette offre */
  alreadyApplied: boolean;
}

type DocKind = 'cv' | 'letter';

/** Un document affiché dans la liste, CV ou lettre */
interface DocItem {
  id: number;
  name: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
  isDefault: boolean;
}


@Component({
  selector: 'app-apply-dialog',
  standalone: true,
  templateUrl: './apply-dialog.component.html',
  styleUrl: './apply-dialog.component.scss',
})
export class ApplyDialogComponent {
  private ai = inject(AiService);
  private documents = inject(DocumentsService);
  private applyApi = inject(ApplyService);
  private destroyRef = inject(DestroyRef);

  readonly offer = input.required<ApplyDialogOffer>();
  readonly applied = output<ApplyDialogResult>();
  readonly closed = output<void>();

  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private cvSection = viewChild<ElementRef<HTMLElement>>('cvSection');
  private letterSection = viewChild<ElementRef<HTMLElement>>('letterSection');

  readonly accept = DOCUMENT_ACCEPT;

  // ── Documents disponibles ─────────────────────────────────
  readonly cvs = signal<DocItem[]>([]);
  readonly letters = signal<DocItem[]>([]);
  readonly loadingDocs = signal(true);
  readonly loadError = signal<string | null>(null);

  // ── Choix du candidat : rien par défaut ───────────────────
  readonly selectedCvId = signal<number | null>(null);
  readonly selectedLetterId = signal<number | null>(null);
  /** Liste ouverte pour changer de document (sinon : seul le document choisi est affiché) */
  readonly editingCv = signal(true);
  readonly editingLetter = signal(true);

  readonly selectedCv = computed(() => this.cvs().find(d => d.id === this.selectedCvId()) ?? null);
  readonly selectedLetter = computed(() => this.letters().find(d => d.id === this.selectedLetterId()) ?? null);

  // ── Téléversement ─────────────────────────────────────────
  readonly uploading = signal<DocKind | null>(null);
  readonly uploadError = signal<{ kind: DocKind; text: string } | null>(null);

  // ── Envoi ─────────────────────────────────────────────────
  readonly sending = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly done = signal(false);
  readonly score = signal<number | null>(null);

  readonly missing = computed(() => {
    const m: string[] = [];
    if (!this.selectedCv()) m.push('un CV');
    if (!this.selectedLetter()) m.push('une lettre de motivation');
    return m;
  });

  readonly canConfirm = computed(() =>
    !!this.selectedCv() && !!this.selectedLetter() && !this.sending() && !this.uploading() && !this.done());

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
    this.loadDocuments();
  }

  // ── Chargement ────────────────────────────────────────────
  loadDocuments(): void {
    this.loadingDocs.set(true);
    this.loadError.set(null);
    forkJoin({ cvs: this.ai.listCvs(), letters: this.documents.listCoverLetters() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cvs, letters }) => {
          this.cvs.set(cvs.map(fromCv));
          this.letters.set(letters.map(fromLetter));
          this.loadingDocs.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingDocs.set(false);
          this.loadError.set(err.status === 409
            ? 'Complétez d\'abord votre profil candidat pour pouvoir postuler.'
            : 'Vos documents n\'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.');
        },
      });
  }

  // ── Sélection ─────────────────────────────────────────────
  pick(kind: DocKind, id: number): void {
    this.submitError.set(null);
    if (kind === 'cv') {
      this.selectedCvId.set(id);
      this.editingCv.set(false);
    } else {
      this.selectedLetterId.set(id);
      this.editingLetter.set(false);
    }
  }

  /** « Changer » : rouvre la liste ; le choix actuel reste coché tant qu'un autre n'est pas pris */
  change(kind: DocKind): void {
    const section = kind === 'cv' ? this.cvSection() : this.letterSection();
    if (kind === 'cv') this.editingCv.set(true); else this.editingLetter.set(true);
    section?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** « Retirer » : plus aucun document choisi pour cette rubrique */
  clear(kind: DocKind): void {
    if (kind === 'cv') { this.selectedCvId.set(null); this.editingCv.set(true); }
    else { this.selectedLetterId.set(null); this.editingLetter.set(true); }
  }

  // ── Téléversement d'un nouveau document ──────────────────
  onFile(kind: DocKind, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = ''; // permet de renvoyer le même fichier après une erreur
    if (!file || this.uploading()) return;

    this.uploadError.set(null);
    const problem = checkDocument(file);
    if (problem) {
      this.uploadError.set({ kind, text: problem });
      return;
    }

    this.uploading.set(kind);
    const done = (item: DocItem) => {
      this.uploading.set(null);
      if (kind === 'cv') this.cvs.update(list => [item, ...list]);
      else this.letters.update(list => [item, ...list]);
      this.pick(kind, item.id); // le fichier que le candidat vient d'envoyer devient son choix
    };
    const fail = (err: HttpErrorResponse) => {
      this.uploading.set(null);
      const message = (err.error as { message?: string } | null)?.message;
      this.uploadError.set({
        kind,
        text: err.status === 0
          ? 'Le serveur JobRadar ne répond pas. Vérifiez que le backend est lancé.'
          : message || 'Le fichier n\'a pas pu être envoyé. Réessayez.',
      });
    };

    if (kind === 'cv') {
      // 1. Envoi du fichier, 2. enregistrement dans « Mes CV » (sans devenir le CV par défaut)
      this.documents.uploadCvFile(file).pipe(
        switchMap(f => this.ai.createCv({
          title: stripExtension(f.fileName),
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          contentType: f.contentType,
          fileSize: f.fileSize,
          makeDefault: false,
        })),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({ next: cv => done(fromCv(cv)), error: fail });
    } else {
      this.documents.uploadCoverLetter(file, stripExtension(file.name))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: l => done(fromLetter(l)), error: fail });
    }
  }

  // ── Confirmation ──────────────────────────────────────────
  confirm(): void {
    const cv = this.selectedCv();
    const letter = this.selectedLetter();
    if (!cv || !letter || !this.canConfirm()) return;

    this.sending.set(true);
    this.submitError.set(null);
    this.applyApi.apply({ jobOfferId: this.offer().id, cvId: cv.id, coverLetterId: letter.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.sending.set(false);
          this.done.set(true);
          this.score.set(res.matchScore);
          this.applied.emit({ jobOfferId: res.jobOfferId, matchScore: res.matchScore, alreadyApplied: false });
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          const message = (err.error as { message?: string } | null)?.message;
          if (err.status === 409 && message?.includes('déjà postulé')) {
            this.applied.emit({ jobOfferId: this.offer().id, matchScore: null, alreadyApplied: true });
            this.submitError.set('Vous avez déjà postulé à cette offre.');
            return;
          }
          switch (err.status) {
            case 0: this.submitError.set('Le serveur JobRadar ne répond pas. Vérifiez que le backend est lancé.'); break;
            case 401:
            case 403: this.submitError.set('Connectez-vous avec un compte candidat pour postuler.'); break;
            case 410: this.submitError.set('Cette offre n\'accepte plus de candidatures.'); break;
            default: this.submitError.set(message || 'La candidature n\'a pas pu être envoyée. Réessayez.');
          }
        },
      });
  }

  // ── Fermeture ─────────────────────────────────────────────
  close(): void {
    if (this.sending()) return;
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
    this.closed.emit();
  }

  /** Échap : on passe par close() pour prévenir le parent */
  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  /** Clic sur le fond sombre (en dehors du panneau) */
  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  // ── Affichage ─────────────────────────────────────────────
  fileIcon(item: DocItem): string {
    const t = (item.contentType || item.fileName).toLowerCase();
    return t.includes('pdf') ? 'ti-file-type-pdf' : 'ti-file-type-doc';
  }

  fileMeta(item: DocItem): string {
    const parts: string[] = [];
    const ext = item.fileName.split('.').pop();
    if (ext && ext !== item.fileName) parts.push(ext.toUpperCase());
    if (item.fileSize) parts.push(formatSize(item.fileSize));
    const d = new Date(item.createdAt);
    if (!isNaN(d.getTime())) parts.push('ajouté le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }));
    return parts.join(' · ');
  }
}

// ── Conversion vers un format commun ────────────────────────
function fromCv(cv: CandidateCv): DocItem {
  return {
    id: cv.id, name: cv.title || cv.fileName, fileName: cv.fileName, fileUrl: cv.fileUrl,
    contentType: cv.contentType, fileSize: cv.fileSize, createdAt: cv.createdAt, isDefault: cv.defaultCv,
  };
}

function fromLetter(l: SavedCoverLetter): DocItem {
  return {
    id: l.id, name: l.title || l.fileName, fileName: l.fileName, fileUrl: l.fileUrl,
    contentType: l.contentType, fileSize: l.fileSize, createdAt: l.createdAt, isDefault: false,
  };
}

function stripExtension(name: string): string {
  return name.replace(/\.(pdf|docx?)$/i, '').trim() || name;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
