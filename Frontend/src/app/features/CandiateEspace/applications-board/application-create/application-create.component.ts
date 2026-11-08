import { AfterViewInit, Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApplicationCard,
  ApplicationTrackingService,
} from '../../../../core/services/application-tracking.service';
import {
  ApplicationStatus,
  BOARD_COLUMNS,
  CONTRACT_TYPES,
  contractLabel,
} from '../../../../core/models/application-status';

/**
 * Ajout d'une candidature faite en dehors de JobRadar (LinkedIn, site de l'entreprise, salon…).
 * Les offres JobRadar et France Travail s'ajoutent depuis la page Offres (Enregistrer / Postuler).
 */
@Component({
  selector: 'jr-application-create',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './application-create.component.html',
  styleUrl: './application-create.component.scss',
})
export class ApplicationCreateComponent implements AfterViewInit {
  private api = inject(ApplicationTrackingService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  readonly closed = output<void>();
  readonly created = output<ApplicationCard>();

  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Étapes proposées à la création (toutes sauf « Retirée ») */
  readonly statuses = BOARD_COLUMNS.filter(c => c.status !== 'WITHDRAWN');
  readonly contracts = CONTRACT_TYPES.map(value => ({ value, label: contractLabel(value) }));

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    jobTitle: ['', [Validators.required, Validators.maxLength(255)]],
    company: ['', Validators.maxLength(255)],
    location: ['', Validators.maxLength(150)],
    contractType: [''],
    jobUrl: ['', [Validators.maxLength(1000), Validators.pattern(/^(https?:\/\/\S+)?$/i)]],
    status: ['APPLIED' as ApplicationStatus, Validators.required],
    appliedAt: [todayIso()],
  });

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  /** La date d'envoi n'a de sens qu'après « Enregistrée » */
  get needsDate(): boolean {
    return this.form.controls.status.value !== 'TO_APPLY';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.create({
      jobTitle: v.jobTitle.trim(),
      company: v.company.trim() || null,
      location: v.location.trim() || null,
      contractType: v.contractType || null,
      jobUrl: v.jobUrl.trim() || null,
      status: v.status,
      appliedAt: v.status !== 'TO_APPLY' && v.appliedAt ? v.appliedAt : null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: card => {
        this.saving.set(false);
        this.dialog().nativeElement.close();
        this.created.emit(card);
      },
      error: err => {
        this.saving.set(false);
        this.error.set(ApplicationTrackingService.errorMessage(err, 'La candidature n\'a pas pu être ajoutée.'));
      },
    });
  }

  cancel(): void {
    this.dialog().nativeElement.close();
  }

  /** Fermeture (bouton, Échap ou clic hors de la fenêtre) */
  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.cancel();
  }

  invalid(name: 'jobTitle' | 'jobUrl'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
