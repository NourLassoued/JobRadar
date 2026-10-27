import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SECTOR_OPTIONS_SORTED, SectorType } from '../../../core/models/candidate';
import { cleanLabel } from '../../../core/models/sector.utils';
import { CandidateService } from '../../../core/services/candidate.service';
import {
  COMPANY_SIZE_LABELS,
  Company,
  CompanyRequest,
  CompanySize,
  RecruiterService,
  toRecruiterError,
} from '../../../core/services/recruiter.service';
import { RECRUITER_BASE } from '../recruiter.routes';

/** http(s)://… ; vide accepté */
const URL_PATTERN = /^https?:\/\/[^\s]+\.[^\s]+$/i;

type CompanyField = keyof CompanyRequest;

/** Une ligne de la liste « profil complété » (for = id du champ à ouvrir au clic) */
interface ChecklistItem {
  for: string;
  label: string;
  done: boolean;
}


@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './company-profile.component.html',
  styleUrl: './company-profile.component.scss',
})
export class CompanyProfileComponent implements OnInit {
  private api = inject(RecruiterService);
  /** Réutilise la validation et l'aperçu d'image de la photo de profil candidat */
  private files = inject(CandidateService);
  private fb = inject(NonNullableFormBuilder);
  private destroyRef = inject(DestroyRef);

  readonly base = RECRUITER_BASE;
  readonly sectors = SECTOR_OPTIONS_SORTED.map(o => ({ value: o.value, label: cleanLabel(o.label) }));
  readonly sizes = (Object.keys(COMPANY_SIZE_LABELS) as CompanySize[])
    .map(value => ({ value, label: COMPANY_SIZE_LABELS[value] }));

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly company = signal<Company | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  /** Erreurs renvoyées par le backend, champ par champ */
  readonly serverErrors = signal<Partial<Record<CompanyField, string>>>({});
  readonly logoPreview = signal('');
  readonly logoBroken = signal(false);
  /** Envoi du logo en cours */
  readonly uploadingLogo = signal(false);
  readonly logoError = signal<string | null>(null);
  /** Afficher le champ « adresse du logo » (option avancée) */
  readonly showLogoUrl = signal(false);

  readonly isNew = computed(() => this.company() === null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(5000)],
    sector: this.fb.control<SectorType | ''>('', Validators.required),
    size: this.fb.control<CompanySize | ''>(''),
    city: ['', Validators.maxLength(120)],
    website: ['', [Validators.pattern(URL_PATTERN), Validators.maxLength(255)]],
    linkedinUrl: ['', [Validators.pattern(URL_PATTERN), Validators.maxLength(255)]],
    logoUrl: ['', [Validators.pattern(URL_PATTERN), Validators.maxLength(1000)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(150)]],
  });

  readonly descriptionLength = signal(0);

  // ── Complétude du profil (mise à jour à chaque frappe) ──
  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly checklist = computed<ChecklistItem[]>(() => {
    this.formValue();
    const v = this.form.getRawValue();
    const has = (s: string) => s.trim().length > 0;
    return [
      { for: 'c-logo-file', label: 'Logo', done: !!this.logoPreview() && !this.logoBroken() },
      { for: 'c-name', label: "Nom de l'entreprise", done: has(v.name) },
      { for: 'c-sector', label: 'Secteur', done: !!v.sector },
      { for: 'c-city', label: 'Ville du siège', done: has(v.city) },
      { for: 'c-desc', label: 'Présentation (80 caractères ou plus)', done: v.description.trim().length >= 80 },
      { for: 'c-email', label: 'E-mail de contact', done: has(v.contactEmail) },
      { for: 'c-web', label: 'Site web ou LinkedIn', done: has(v.website) || has(v.linkedinUrl) },
    ];
  });

  readonly completion = computed(() => {
    const items = this.checklist();
    return Math.round((items.filter(i => i.done).length / items.length) * 100);
  });

  /** Libellé du secteur choisi (pour l'en-tête) */
  readonly sectorName = computed(() => {
    this.formValue();
    const code = this.form.controls.sector.value;
    return this.sectors.find(s => s.value === code)?.label ?? '';
  });

  /** Longueur du cercle de progression (rayon 26) */
  readonly ringLength = 2 * Math.PI * 26;

  ngOnInit(): void {
    this.form.controls.logoUrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(url => {
      this.logoBroken.set(false);
      this.logoPreview.set(URL_PATTERN.test(url) ? url : '');
    });
    this.form.controls.description.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.descriptionLength.set(v.length));

    this.api.getCompany().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: company => {
        this.company.set(company);
        if (company) this.fill(company);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(toRecruiterError(err).message);
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);
    this.serverErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Une adresse de logo invalide doit être visible pour être corrigée
      if (this.form.controls.logoUrl.invalid) this.showLogoUrl.set(true);
      this.error.set('Vérifiez les champs signalés en rouge.');
      return;
    }

    const wasNew = this.isNew();
    this.saving.set(true);
    this.api.saveCompany(this.payload()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: company => {
        this.company.set(company);
        this.fill(company);
        this.form.markAsPristine();
        this.saving.set(false);
        this.success.set(wasNew
          ? 'Profil entreprise créé. Vous pouvez maintenant publier votre première offre.'
          : 'Modifications enregistrées.');
      },
      error: err => {
        const e = toRecruiterError(err);
        this.serverErrors.set(e.fields as Partial<Record<CompanyField, string>>);
        this.error.set(e.message);
        this.saving.set(false);
      },
    });
  }

  /** Message à afficher sous un champ (validation locale d'abord, puis backend) */
  fieldError(name: CompanyField): string | null {
    const control = this.form.controls[name];
    if (control.touched && control.errors) {
      if (control.errors['required']) return 'Champ obligatoire.';
      if (control.errors['maxlength']) return `${control.errors['maxlength'].requiredLength} caractères maximum.`;
      if (control.errors['email']) return 'Adresse e-mail invalide.';
      if (control.errors['pattern']) return 'Adresse web invalide (elle doit commencer par https://).';
    }
    return this.serverErrors()[name] ?? null;
  }

  // ── Logo ────────────────────────────────────────────────

  /** Fichier choisi (bouton ou glisser-déposer) : vérifié, envoyé, puis mis dans logoUrl */
  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de re-choisir le même fichier
    if (file) this.uploadLogo(file);
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadLogo(file);
  }

  removeLogo(): void {
    this.form.controls.logoUrl.setValue('');
    this.form.controls.logoUrl.markAsDirty();
    this.logoError.set(null);
  }

  private async uploadLogo(file: File): Promise<void> {
    this.logoError.set(null);

    // Même validation que la photo de profil (JPEG, PNG, GIF, WebP, 5 Mo max)
    const check = this.files.isValidImageFile(file);
    if (!check.valid) {
      this.logoError.set(check.error ?? 'Image invalide.');
      return;
    }

    // Aperçu immédiat, avant même la fin de l'envoi
    const previous = this.form.controls.logoUrl.value;
    try {
      this.logoBroken.set(false);
      this.logoPreview.set(await this.files.getImagePreviewUrl(file));
    } catch { /* l'aperçu local est facultatif */ }

    this.uploadingLogo.set(true);
    this.api.uploadLogo(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ url }) => {
        this.form.controls.logoUrl.setValue(url); // l'aperçu passe sur l'image en ligne
        this.form.controls.logoUrl.markAsDirty();
        this.uploadingLogo.set(false);
        this.success.set(null);
      },
      error: err => {
        this.logoError.set(toRecruiterError(err).message);
        this.logoPreview.set(URL_PATTERN.test(previous) ? previous : ''); // on remet l'ancien logo
        this.uploadingLogo.set(false);
      },
    });
  }

  sizeLabel(size: CompanySize | ''): string {
    return size ? COMPANY_SIZE_LABELS[size] : '';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
  }

  private fill(c: Company): void {
    this.form.setValue({
      name: c.name,
      description: c.description ?? '',
      sector: c.sector,
      size: c.size ?? '',
      city: c.city ?? '',
      website: c.website ?? '',
      linkedinUrl: c.linkedinUrl ?? '',
      logoUrl: c.logoUrl ?? '',
      contactEmail: c.contactEmail ?? '',
    });
  }

  private payload(): CompanyRequest {
    const v = this.form.getRawValue();
    const orNull = (s: string) => (s.trim() ? s.trim() : null);
    return {
      name: v.name.trim(),
      description: orNull(v.description),
      sector: v.sector as SectorType,
      size: v.size || null,
      city: orNull(v.city),
      website: orNull(v.website),
      linkedinUrl: orNull(v.linkedinUrl),
      logoUrl: orNull(v.logoUrl),
      contactEmail: orNull(v.contactEmail),
    };
  }
}