import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { SECTOR_OPTIONS_SORTED, SectorType } from '../../../core/models/candidate';
import { cleanLabel } from '../../../core/models/sector.utils';
import {
  CONTRACT_OPTIONS,
  Company,
  ContractCode,
  contractLabel,
  JobPostRequest,
  RecruiterJob,
  RecruiterService,
  toRecruiterError,
} from '../../../core/services/recruiter.service';
import { RECRUITER_BASE } from '../recruiter.routes';

export const MAX_SKILLS = 20;
export const MIN_DESCRIPTION = 50;

type JobField = keyof JobPostRequest;

/** Une ligne de « qualité de l'offre » (for = id du champ à ouvrir au clic) */
interface QualityItem {
  for: string;
  label: string;
  done: boolean;
}

/** Description jugée complète à partir de cette longueur */
export const GOOD_DESCRIPTION = 300;

/** Salaire min ≤ salaire max (si les deux sont renseignés) */
function salaryRange(group: AbstractControl): ValidationErrors | null {
  const min = group.get('salaryMin')?.value as number | null;
  const max = group.get('salaryMax')?.value as number | null;
  return min != null && max != null && min > max ? { salaryRange: true } : null;
}

/** Ajoute des compétences sans doublon (insensible à la casse), dans la limite de MAX_SKILLS */
export function addSkills(current: string[], raw: string): string[] {
  const next = [...current];
  for (const part of raw.split(/[,;\n]/)) {
    const skill = part.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!skill || next.length >= MAX_SKILLS) continue;
    if (!next.some(s => s.toLowerCase() === skill.toLowerCase())) next.push(skill);
  }
  return next;
}

@Component({
  selector: 'app-job-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './job-form.component.html',
  styleUrl: './job-form.component.scss',
})
export class JobFormComponent implements OnInit {
  private api = inject(RecruiterService);
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly base = RECRUITER_BASE;
  readonly maxSkills = MAX_SKILLS;
  readonly minDescription = MIN_DESCRIPTION;
  readonly contracts = CONTRACT_OPTIONS;
  readonly sectors = SECTOR_OPTIONS_SORTED.map(o => ({ value: o.value, label: cleanLabel(o.label) }));

  /** null = création */
  readonly jobId = signal<number | null>(null);
  readonly isEdit = computed(() => this.jobId() !== null);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Pas encore de profil entreprise : on bloque le formulaire */
  readonly noCompany = signal(false);
  readonly serverErrors = signal<Partial<Record<JobField, string>>>({});
  readonly skills = signal<string[]>([]);
  readonly skillDraft = signal('');
  readonly descriptionLength = signal(0);
  readonly applicantsCount = signal(0);
  /** Entreprise du recruteur (logo et nom dans l'aperçu) */
  readonly company = signal<Company | null>(null);
  readonly contractLabel = contractLabel;
  readonly goodDescription = GOOD_DESCRIPTION;

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.minLength(MIN_DESCRIPTION), Validators.maxLength(10000)]],
    requirements: ['', Validators.maxLength(5000)],
    location: ['', [Validators.required, Validators.maxLength(150)]],
    contractType: this.fb.control<ContractCode | ''>('CDI', Validators.required),
    remote: [false],
    salaryMin: this.fb.control<number | null>(null, Validators.min(0)),
    salaryMax: this.fb.control<number | null>(null, Validators.min(0)),
    sector: this.fb.control<SectorType | ''>('', Validators.required),
    experienceYears: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(30)]),
  }, { validators: salaryRange });

  // ── Aperçu et qualité de l'offre (mis à jour à chaque frappe) ──
  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly quality = computed<QualityItem[]>(() => {
    this.formValue();
    const v = this.form.getRawValue();
    return [
      { for: 'j-title', label: 'Intitulé du poste', done: v.title.trim().length >= 5 },
      { for: 'j-desc', label: `Description détaillée (${GOOD_DESCRIPTION} caractères)`, done: v.description.trim().length >= GOOD_DESCRIPTION },
      { for: 'j-skill', label: '3 compétences ou plus', done: this.skills().length >= 3 },
      { for: 'j-exp', label: 'Expérience demandée', done: v.experienceYears !== null },
      { for: 'j-smin', label: 'Salaire indiqué', done: v.salaryMin !== null || v.salaryMax !== null },
    ];
  });

  readonly qualityScore = computed(() => {
    const items = this.quality();
    return Math.round((items.filter(i => i.done).length / items.length) * 100);
  });

  /** Longueur du cercle de qualité (rayon 26) */
  readonly ringLength = 2 * Math.PI * 26;

  /** « 28 k€ – 34 k€ » pour l'aperçu */
  readonly salaryLabel = computed(() => {
    this.formValue();
    const { salaryMin: min, salaryMax: max } = this.form.getRawValue();
    const k = (n: number) => `${Math.round(n / 1000)} k€`;
    if (min && max) return `${k(min)} – ${k(max)}`;
    if (min) return `dès ${k(min)}`;
    if (max) return `jusqu'à ${k(max)}`;
    return null;
  });

  readonly experienceLabel = computed(() => {
    this.formValue();
    const y = this.form.controls.experienceYears.value;
    if (y === null) return null;
    return y === 0 ? 'Débutant accepté' : `${y} an${y > 1 ? 's' : ''} d'expérience`;
  });

  readonly sectorName = computed(() => {
    this.formValue();
    return this.sectors.find(s => s.value === this.form.controls.sector.value)?.label ?? '';
  });

  setContract(code: ContractCode): void {
    this.form.controls.contractType.setValue(code);
    this.form.controls.contractType.markAsDirty();
  }

  /** Boutons − / + de l'expérience */
  stepExperience(delta: number): void {
    const c = this.form.controls.experienceYears;
    const next = Math.max(0, Math.min(30, (c.value ?? (delta > 0 ? -1 : 0)) + delta));
    c.setValue(next);
    c.markAsDirty();
  }

  companyInitials(): string {
    const name = this.company()?.name?.trim() ?? '';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
  }

  ngOnInit(): void {
    this.form.controls.description.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.descriptionLength.set(v.length));

    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;
    this.jobId.set(id !== null && Number.isFinite(id) ? id : null);

    forkJoin({
      company: this.api.getCompany(),
      job: this.jobId() !== null ? this.api.getJob(this.jobId()!) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ company, job }) => {
        this.company.set(company);
        if (!company) {
          this.noCompany.set(true);
        } else if (job) {
          this.fill(job);
        } else {
          // Nouvelle offre : secteur et ville de l'entreprise par défaut
          this.form.patchValue({ sector: company.sector, location: company.city ?? '' });
        }
        this.loading.set(false);
      },
      error: err => {
        this.error.set(toRecruiterError(err).message);
        this.loading.set(false);
      },
    });
  }

  // ── Compétences ─────────────────────────────────────────

  onSkillInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Coller « Java, SQL, Docker » ajoute les trois d'un coup
    if (/[,;\n]/.test(value)) {
      this.skills.update(list => addSkills(list, value));
      this.skillDraft.set('');
      (event.target as HTMLInputElement).value = '';
    } else {
      this.skillDraft.set(value);
    }
  }

  onSkillKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitSkill(input);
    } else if (event.key === 'Backspace' && !input.value && this.skills().length) {
      this.skills.update(list => list.slice(0, -1));
    }
  }

  commitSkill(input: HTMLInputElement): void {
    if (!input.value.trim()) return;
    this.skills.update(list => addSkills(list, input.value));
    input.value = '';
    this.skillDraft.set('');
  }

  removeSkill(skill: string): void {
    this.skills.update(list => list.filter(s => s !== skill));
  }

  // ── Envoi ───────────────────────────────────────────────

  submit(): void {
    this.error.set(null);
    this.serverErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Vérifiez les champs signalés en rouge.');
      return;
    }

    const body = this.payload();
    const id = this.jobId();
    const request$ = id === null ? this.api.createJob(body) : this.api.updateJob(id, body);

    this.saving.set(true);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.router.navigate([this.base]);
      },
      error: err => {
        const e = toRecruiterError(err);
        this.serverErrors.set(e.fields as Partial<Record<JobField, string>>);
        this.error.set(e.message);
        this.saving.set(false);
      },
    });
  }

  fieldError(name: Exclude<JobField, 'skills'>): string | null {
    const control = this.form.controls[name];
    if (control.touched && control.errors) {
      const e = control.errors;
      if (e['required']) return 'Champ obligatoire.';
      if (e['minlength']) return `${e['minlength'].requiredLength} caractères minimum (actuellement ${e['minlength'].actualLength}).`;
      if (e['maxlength']) return `${e['maxlength'].requiredLength} caractères maximum.`;
      if (e['min']) return 'La valeur ne peut pas être négative.';
      if (e['max']) return `${e['max'].max} au maximum.`;
    }
    return this.serverErrors()[name] ?? null;
  }

  salaryError(): string | null {
    const touched = this.form.controls.salaryMin.touched || this.form.controls.salaryMax.touched;
    return touched && this.form.hasError('salaryRange')
      ? 'Le salaire minimum doit être inférieur ou égal au maximum.'
      : null;
  }

  private fill(job: RecruiterJob): void {
    const contract = this.contracts.some(c => c.value === job.contractType) ? job.contractType as ContractCode : '';
    this.form.setValue({
      title: job.title,
      description: job.description,
      requirements: job.requirements ?? '',
      location: job.location,
      contractType: contract,
      remote: job.remote,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      sector: (job.sector as SectorType | null) ?? '',
      experienceYears: job.experienceYears,
    });
    this.skills.set(job.skills);
    this.applicantsCount.set(job.applicantsCount);
  }

  private payload(): JobPostRequest {
    const v = this.form.getRawValue();
    const num = (n: number | null) => (n === null || Number.isNaN(n) ? null : n);
    // Une compétence tapée mais pas encore validée par Entrée est quand même envoyée
    const skills = this.skillDraft().trim() ? addSkills(this.skills(), this.skillDraft()) : this.skills();
    return {
      title: v.title.trim(),
      description: v.description.trim(),
      requirements: v.requirements.trim() || null,
      location: v.location.trim(),
      contractType: v.contractType as ContractCode,
      remote: v.remote,
      salaryMin: num(v.salaryMin),
      salaryMax: num(v.salaryMax),
      sector: v.sector as SectorType,
      skills,
      experienceYears: num(v.experienceYears),
    };
  }
}