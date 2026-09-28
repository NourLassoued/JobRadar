import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CandidateService } from '../../core/services/candidate.service';
import { CandidateRequest, CandidateResponse, SECTOR_LABELS, SectorType } from '../../core/models/candidate';
import { SECTOR_ICONS } from '../../core/models/sector.utils';

type Notice = { type: 'success' | 'error'; text: string };

/** Champs pris en compte pour le taux de complétion du profil */
const COMPLETION_FIELDS: { key: keyof CandidateResponse; label: string }[] = [
  { key: 'profileImageUrl', label: 'Photo' },
  { key: 'phoneNumber', label: 'Téléphone' },
  { key: 'city', label: 'Ville' },
  { key: 'sector', label: 'Secteur' },
  { key: 'yearsOfExperience', label: 'Expérience' },
  { key: 'skills', label: 'Compétences' },
  { key: 'bio', label: 'Présentation' },
  { key: 'cvUrl', label: 'CV' },
  { key: 'linkedinUrl', label: 'LinkedIn' },
];

@Component({
  selector: 'jr-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private candidateService = inject(CandidateService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  @ViewChild('profileImageInput') profileImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cvInput') cvInput?: ElementRef<HTMLInputElement>;

  // ── Données ────────────────────────────────────────────────
  candidate = signal<CandidateResponse | null>(null);
  isOwner = signal(true);

  // ── État UI ────────────────────────────────────────────────
  isLoading = signal(true);
  isEditing = signal(false);
  isSaving = signal(false);
  notice = signal<Notice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  // ── Fichiers ───────────────────────────────────────────────
  selectedProfileImage = signal<File | null>(null);
  profileImagePreview = signal<string | null>(null);
  isUploadingProfileImage = signal(false);

  selectedCV = signal<File | null>(null);
  isUploadingCV = signal(false);

  // ── Computed ───────────────────────────────────────────────
  avatarSrc = computed(() => this.profileImagePreview() || this.candidate()?.profileImageUrl || '');

  userInitial = computed(() => {
    const c = this.candidate();
    if (!c?.firstName) return '?';
    return (c.firstName.charAt(0) + (c.lastName?.charAt(0) || '')).toUpperCase();
  });

  fullName = computed(() => {
    const c = this.candidate();
    return c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Candidat' : '';
  });

  headline = computed(() => {
    const c = this.candidate();
    if (!c) return '';
    const parts: string[] = [];
    if (c.sector) parts.push(this.getSectorLabel(c.sector));
    if (c.yearsOfExperience != null) {
      parts.push(`${c.yearsOfExperience} an${c.yearsOfExperience > 1 ? 's' : ''} d'expérience`);
    }
    return parts.join(', ');
  });

  skillsArray = computed(() => {
    const c = this.candidate();
    return c?.skills ? this.candidateService.parseSkills(c.skills) : [];
  });

  cvDisplayName = computed(() => {
    const staged = this.selectedCV();
    if (staged) return staged.name;
    const url = this.candidate()?.cvUrl;
    if (!url) return '';
    try {
      const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      return last || 'CV';
    } catch {
      return 'CV';
    }
  });

  completionState = computed(() => {
    const c = this.candidate();
    return COMPLETION_FIELDS.map(f => {
      const v = c?.[f.key];
      return { label: f.label, done: v !== null && v !== undefined && v !== '' };
    });
  });

  completion = computed(() => {
    const s = this.completionState();
    return Math.round((s.filter(f => f.done).length / s.length) * 100);
  });

  missingFields = computed(() => this.completionState().filter(f => !f.done).map(f => f.label));

  // ── Formulaire ─────────────────────────────────────────────
  profileForm!: FormGroup;
  sectorOptions = Object.entries(SECTOR_LABELS).map(([value, label]) => ({
    value,
    label,
    icon: SECTOR_ICONS[value] || SECTOR_ICONS['OTHER'],
  }));

  sectorIcon(sector?: string | null): string {
    return (sector && SECTOR_ICONS[sector]) || SECTOR_ICONS['OTHER'];
  }

  clearSector(): void {
    this.profileForm.patchValue({ sector: '' });
    this.profileForm.get('sector')?.markAsDirty();
  }

  ngOnInit(): void {
    this.initForm();
    this.loadCandidate();
  }

  // ── Chargement ─────────────────────────────────────────────
  private loadCandidate(): void {
    this.isLoading.set(true);
    const idFromUrl = this.route.snapshot.params['id'] as string | undefined;
    const currentUserId = this.authService.getCurrentUserId();
    const ownProfile = !idFromUrl || +idFromUrl === currentUserId;
    this.isOwner.set(ownProfile);

    if (ownProfile) {
      this.authService.getCurrentUserInfo().pipe(
        switchMap(userInfo => this.candidateService.getCandidateById(currentUserId).pipe(
          // Pas encore de fiche candidat : on part des infos du compte
          catchError(() => of<CandidateResponse>({
            id: currentUserId,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            email: userInfo.email,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        )),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: c => this.applyCandidate(c),
        error: () => this.failLoading('Impossible de charger votre profil. Rechargez la page.'),
      });
      return;
    }

    this.candidateService.getCandidateById(+idFromUrl!).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: c => this.applyCandidate(c),
      error: () => this.failLoading("Ce profil n'existe pas ou n'est plus disponible."),
    });
  }

  private applyCandidate(c: CandidateResponse): void {
    this.candidate.set(c);
    this.populateForm(c);
    this.isLoading.set(false);
  }

  private failLoading(text: string): void {
    this.isLoading.set(false);
    this.showNotice('error', text);
  }

  // ── Formulaire ─────────────────────────────────────────────
  private initForm(): void {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: [{ value: '', disabled: true }],
      phoneNumber: ['', [Validators.pattern(/^[\d\s\-+()]*$/)]],
      city: ['', [Validators.maxLength(200)]],
      sector: [''],
      yearsOfExperience: [null, [Validators.min(0), Validators.max(70)]],
      skills: [''],
      bio: ['', [Validators.maxLength(1000)]],
      expectedSalary: [null, [Validators.min(0)]],
      remotePreference: [false],
      cvUrl: ['', [Validators.pattern(/^(https?:\/\/.+)?$/)]],
      linkedinUrl: ['', [Validators.pattern(/^(https?:\/\/.+)?$/)]],
    });
  }

  private populateForm(c: CandidateResponse): void {
    this.profileForm.reset({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      email: c.email || '',
      phoneNumber: c.phoneNumber || '',
      city: c.city || '',
      sector: c.sector || '',
      yearsOfExperience: c.yearsOfExperience ?? null,
      skills: c.skills ? this.candidateService.parseSkills(c.skills).join(', ') : '',
      bio: c.bio || '',
      expectedSalary: c.expectedSalary ?? null,
      remotePreference: c.remotePreference || false,
      cvUrl: c.cvUrl || '',
      linkedinUrl: c.linkedinUrl || '',
    });
  }

  get bioLength(): number {
    return (this.profileForm.get('bio')?.value || '').length;
  }

  // ── Photo de profil ────────────────────────────────────────
  pickProfileImage(): void {
    if (this.isOwner()) this.profileImageInput?.nativeElement.click();
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;

    const validation = this.candidateService.isValidImageFile(file);
    if (!validation.valid) {
      this.showNotice('error', validation.error || 'Format d\'image non pris en charge.');
      return;
    }

    this.selectedProfileImage.set(file);
    this.candidateService.getImagePreviewUrl(file)
      .then(preview => this.profileImagePreview.set(preview))
      .catch(err => console.error('Preview error:', err));

    // Hors mode édition, la photo est envoyée tout de suite
    if (!this.isEditing()) this.uploadProfileImage();
  }

  private uploadProfileImage(): void {
    const file = this.selectedProfileImage();
    const c = this.candidate();
    if (!file || !c) return;

    this.isUploadingProfileImage.set(true);
    this.candidateService.uploadProfileImage(c.id, file).subscribe({
      next: updated => {
        this.candidate.set(updated);
        this.clearProfileImage();
        this.isUploadingProfileImage.set(false);
        this.showNotice('success', 'Photo de profil mise à jour.');
      },
      error: err => {
        console.error('Profile image upload error:', err);
        this.clearProfileImage();
        this.isUploadingProfileImage.set(false);
        this.showNotice('error', "La photo n'a pas pu être envoyée. Réessayez avec une image de moins de 5 Mo.");
      },
    });
  }

  clearProfileImage(): void {
    this.selectedProfileImage.set(null);
    this.profileImagePreview.set(null);
  }

  // ── CV ─────────────────────────────────────────────────────
  pickCV(): void {
    if (this.isOwner()) this.cvInput?.nativeElement.click();
  }

  onCVSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const validation = this.candidateService.isValidCVFile(file);
    if (!validation.valid) {
      this.showNotice('error', validation.error || 'Format de fichier non pris en charge.');
      return;
    }

    this.selectedCV.set(file);
    if (!this.isEditing()) this.uploadCV();
  }

  private uploadCV(): void {
    const file = this.selectedCV();
    const c = this.candidate();
    if (!file || !c) return;

    this.isUploadingCV.set(true);
    this.candidateService.uploadCV(c.id, file).subscribe({
      next: updated => {
        this.candidate.set(updated);
        this.profileForm.patchValue({ cvUrl: updated.cvUrl || '' });
        this.selectedCV.set(null);
        this.isUploadingCV.set(false);
        this.showNotice('success', 'CV mis à jour.');
      },
      error: err => {
        console.error('CV upload error:', err);
        this.selectedCV.set(null);
        this.isUploadingCV.set(false);
        this.showNotice('error', "Le CV n'a pas pu être envoyé. Formats acceptés : PDF, DOC, DOCX, TXT (10 Mo max).");
      },
    });
  }

  clearCV(): void {
    this.selectedCV.set(null);
  }

  // ── Édition ────────────────────────────────────────────────
  startEdit(): void {
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    const c = this.candidate();
    if (c) this.populateForm(c);
    this.clearProfileImage();
    this.clearCV();
    this.isEditing.set(false);
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.showNotice('error', 'Certains champs sont invalides. Corrigez-les avant d\'enregistrer.');
      return;
    }

    const c = this.candidate();
    if (!c) return;

    const v = this.profileForm.getRawValue();
    const request: CandidateRequest = {
      firstName: v.firstName?.trim() || '',
      lastName: v.lastName?.trim() || '',
      email: v.email?.trim() || '',
      phoneNumber: v.phoneNumber?.trim() || undefined,
      city: v.city?.trim() || undefined,
      sector: v.sector || undefined,
      yearsOfExperience: v.yearsOfExperience ?? undefined,
      bio: v.bio?.trim() || undefined,
      expectedSalary: v.expectedSalary ?? undefined,
      remotePreference: !!v.remotePreference,
      cvUrl: v.cvUrl?.trim() || undefined,
      linkedinUrl: v.linkedinUrl?.trim() || undefined,
      skills: v.skills
        ? this.candidateService.formatSkills(
            v.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          )
        : undefined,
    };

    const image = this.selectedProfileImage();
    const cv = this.selectedCV();
    const save$ = image || cv
      ? this.candidateService.uploadAndUpdateProfile(c.id, request, image || undefined, cv || undefined)
      : this.candidateService.updateCandidate(c.id, request);

    this.isSaving.set(true);
    save$.subscribe({
      next: data => {
        this.candidate.set(data);
        this.populateForm(data);
        this.clearProfileImage();
        this.clearCV();
        this.isEditing.set(false);
        this.isSaving.set(false);
        this.showNotice('success', 'Modifications enregistrées.');
      },
      error: () => {
        this.isSaving.set(false);
        this.showNotice('error', "Les modifications n'ont pas été enregistrées. Vérifiez votre connexion et réessayez.");
      },
    });
  }

  // ── Utilitaires ────────────────────────────────────────────
  showNotice(type: Notice['type'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ type, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), 5000);
  }

  dismissNotice(): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(null);
  }

  getSectorLabel(sector?: SectorType | string | null): string {
    if (!sector) return '';
    return SECTOR_LABELS[sector as SectorType] || sector;
  }

  formatCurrency(amount?: number | null): string {
    if (amount == null) return '';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  formatDate(date?: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  linkedinHandle(url?: string | null): string {
    if (!url) return '';
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match ? match[1] : url.replace(/^https?:\/\//, '');
  }

  hasError(name: string): boolean {
    const f = this.profileForm.get(name);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }

  getErrorMessage(name: string): string {
    const e = this.profileForm.get(name)?.errors;
    if (!e) return '';
    if (e['required']) return 'Ce champ est obligatoire.';
    if (e['minlength']) return `${e['minlength'].requiredLength} caractères minimum.`;
    if (e['maxlength']) return `${e['maxlength'].requiredLength} caractères maximum.`;
    if (e['email']) return 'Adresse e-mail invalide.';
    if (e['pattern']) return name.endsWith('Url') ? 'Le lien doit commencer par https://' : 'Format invalide.';
    if (e['min']) return `La valeur minimale est ${e['min'].min}.`;
    if (e['max']) return `La valeur maximale est ${e['max'].max}.`;
    return 'Valeur invalide.';
  }
}