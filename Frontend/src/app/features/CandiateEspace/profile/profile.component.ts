import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CandidateService } from '../../../core/services/candidate.service';
import { CandidateRequest, CandidateResponse, SECTOR_LABELS, SectorType } from '../../../core/models/candidate';
import { SECTOR_ICONS, cleanLabel } from '../../../core/models/sector.utils';
import { SectorService } from '../../../core/services/skills.service';
import { LanguageService } from '../../../core/services/language.service';
import { CandidateLanguage, FALLBACK_LANGUAGE_REFERENCE, LanguageLevel, LanguageReference } from '../../../core/models/Language';


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

/** Libellé ajouté à la complétion pour les langues (le champ n'est pas dans COMPLETION_FIELDS) */
const LANGUAGES_LABEL = 'Langues';

@Component({
  selector: 'jr-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  // ═══════════════════════════════════════════════════════════════════════
  //  INJECTION DE DÉPENDANCES
  // ═══════════════════════════════════════════════════════════════════════
  private authService = inject(AuthService);
  private candidateService = inject(CandidateService);
  private sectorService = inject(SectorService);
  private languageService = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  // ═══════════════════════════════════════════════════════════════════════
  //  VIEW CHILDREN (inputs fichiers, toujours présents dans le template)
  // ═══════════════════════════════════════════════════════════════════════
  @ViewChild('profileImageInput') profileImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cvInput') cvInput?: ElementRef<HTMLInputElement>;

  // ═══════════════════════════════════════════════════════════════════════
  //  SIGNAUX - Données principales
  // ═══════════════════════════════════════════════════════════════════════
  candidate = signal<CandidateResponse | null>(null);
  isOwner = signal(true);

  // ═══════════════════════════════════════════════════════════════════════
  //  SIGNAUX - État UI
  // ═══════════════════════════════════════════════════════════════════════
  isLoading = signal(true);
  isEditing = signal(false);
  isSaving = signal(false);
  notice = signal<Notice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  // ═══════════════════════════════════════════════════════════════════════
  //  SIGNAUX - Photo de profil
  // ═══════════════════════════════════════════════════════════════════════
  selectedProfileImage = signal<File | null>(null);
  profileImagePreview = signal<string | null>(null);
  isUploadingProfileImage = signal(false);

  // ═══════════════════════════════════════════════════════════════════════
  //  SIGNAUX - CV
  // ═══════════════════════════════════════════════════════════════════════
  selectedCV = signal<File | null>(null);
  isUploadingCV = signal(false);

  // ═══════════════════════════════════════════════════════════════════════
  //  SIGNAUX - Compétences
  // ═══════════════════════════════════════════════════════════════════════
  sectorSkills = signal<string[]>([]);
  selectedSkills = signal<string[]>([]);
  skillsLoading = signal(false);
  customSkillInput = signal('');
  showSuggestions = signal(false);

  // ═══════════════════════════════════════════════════════════════════════
  //  SIGNAUX - Langues
  // ═══════════════════════════════════════════════════════════════════════
  languages = signal<CandidateLanguage[]>([]);
  languageReference = signal<LanguageReference>(FALLBACK_LANGUAGE_REFERENCE);

  /** Niveaux affichés dans le sélecteur (A1 … C2, Natif) */
  levels = computed(() => this.languageReference().levels);
  /** Les 6 crans de la jauge (A1 → C2) */
  readonly levelSteps = [1, 2, 3, 4, 5, 6];

  /** Langues triées : langue maternelle d'abord, puis du meilleur au plus faible niveau */
  sortedLanguages = computed(() =>
    [...this.languages()]
      .filter(l => l.code)
      .sort((a, b) => this.levelRank(b.level) - this.levelRank(a.level))
  );

  canAddLanguage = computed(() =>
    this.languages().length < this.languageReference().maxPerCandidate &&
    this.languages().every(l => !!l.code)
  );

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPUTED - Suggestions filtrées pendant la saisie
  // ═══════════════════════════════════════════════════════════════════════
  filteredSuggestions = computed(() => {
    const input = this.customSkillInput().toLowerCase().trim();
    if (!input) return [];

    const already = this.selectedSkills().map(s => s.toLowerCase());

    return this.sectorSkills()
      .filter(skill => skill.toLowerCase().includes(input) && !already.includes(skill.toLowerCase()))
      .slice(0, 8);
  });

  /** Libellé du secteur choisi dans le formulaire, ex. « Informatique / Tech » */
  selectedSectorLabel = signal('');

  /** Compétences choisies qui ne viennent pas de la liste du secteur (saisies ou ancien secteur) */
  otherSkills = computed(() => {
    const sector = this.sectorSkills().map(s => s.toLowerCase());
    return this.selectedSkills().filter(s => !sector.includes(s.toLowerCase()));
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPUTED - Données visuelles du profil
  // ═══════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPUTED - Taux de complétion du profil
  // ═══════════════════════════════════════════════════════════════════════
  completionState = computed(() => {
    const c = this.candidate();
    const fields = COMPLETION_FIELDS.map(f => {
      const v = f.key === 'skills' ? this.selectedSkills().length > 0 || null : c?.[f.key];
      return { label: f.label, done: v !== null && v !== undefined && v !== '' };
    });
    return [...fields, { label: LANGUAGES_LABEL, done: this.sortedLanguages().length > 0 }];
  });

  completion = computed(() => {
    const s = this.completionState();
    return Math.round((s.filter(f => f.done).length / s.length) * 100);
  });

  missingFields = computed(() => this.completionState().filter(f => !f.done).map(f => f.label));

  // ═══════════════════════════════════════════════════════════════════════
  //  FORMULAIRE & OPTIONS
  // ═══════════════════════════════════════════════════════════════════════
  profileForm!: FormGroup;

  /** Les 14 secteurs de l'enum Java (sans « Autre »), libellés sans emoji, triés */
  sectorOptions = Object.entries(SECTOR_LABELS)
    .filter(([value]) => value !== 'OTHER')
    .map(([value, label]) => ({
      value,
      label: cleanLabel(label),
      icon: SECTOR_ICONS[value] || SECTOR_ICONS['OTHER'],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  // ═══════════════════════════════════════════════════════════════════════
  //  CYCLE DE VIE
  // ═══════════════════════════════════════════════════════════════════════
  ngOnInit(): void {
    this.initForm();
    this.watchSector();
    this.loadCandidate();

    this.languageService.getReference()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ref => this.languageReference.set(ref));
  }

  /**
   * Dès que le secteur change dans le formulaire (clic, chargement du profil, annulation),
   * on charge ses compétences. switchMap annule la requête précédente si l'utilisateur
   * change vite de secteur : c'est toujours le dernier choix qui s'affiche.
   */
  private watchSector(): void {
    this.profileForm.get('sector')!.valueChanges.pipe(
      map(value => (value || '') as string),
      distinctUntilChanged(),
      tap(code => {
        this.selectedSectorLabel.set(this.getSectorLabel(code));
        this.skillsLoading.set(!!code);
        if (!code) this.sectorSkills.set([]);
      }),
      switchMap(code => (code ? this.sectorService.getSectorSkills(code) : of<string[]>([]))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(skills => {
      this.sectorSkills.set(skills);
      this.skillsLoading.set(false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CHARGEMENT DES DONNÉES
  // ═══════════════════════════════════════════════════════════════════════
  private loadCandidate(): void {
    this.isLoading.set(true);
    const idFromUrl = this.route.snapshot.params['id'] as string | undefined;
    const currentUserId = this.authService.getCurrentUserId();
    const ownProfile = !idFromUrl || +idFromUrl === currentUserId;
    this.isOwner.set(ownProfile);

    if (ownProfile) {
      this.loadOwnProfile(currentUserId);
      return;
    }
    this.loadOtherProfile(+idFromUrl!);
  }

  private loadOwnProfile(userId: number): void {
    this.authService
      .getCurrentUserInfo()
      .pipe(
        switchMap(userInfo =>
          this.candidateService.getCandidateById(userId).pipe(
            // Pas encore de fiche candidat : on part des infos du compte
            catchError(() =>
              of<CandidateResponse>({
                id: userId,
                firstName: userInfo.firstName,
                lastName: userInfo.lastName,
                email: userInfo.email,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            )
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: c => this.applyCandidate(c),
        error: () => this.failLoading('Impossible de charger votre profil. Rechargez la page.'),
      });
  }

  private loadOtherProfile(userId: number): void {
    this.candidateService
      .getCandidateById(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => this.applyCandidate(c),
        error: () => this.failLoading("Ce profil n'existe pas ou n'est plus disponible."),
      });
  }

  private applyCandidate(c: CandidateResponse): void {
    this.candidate.set(c);

    // Compétences du candidat (tableau ou chaîne selon le backend)
    this.selectedSkills.set(this.toSkillList(c.skills));
    this.languages.set(this.toLanguageList(c.languages));

    this.populateForm(c);
    this.isLoading.set(false);
  }

  private failLoading(text: string): void {
    this.isLoading.set(false);
    this.showNotice('error', text);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPÉTENCES
  // ═══════════════════════════════════════════════════════════════════════
  /** Appelé au clic sur un secteur : le chargement des compétences suit automatiquement */
  onSectorChange(newSector: SectorType | string): void {
    this.profileForm.patchValue({ sector: newSector });
    this.profileForm.get('sector')?.markAsDirty();
  }

  toggleSkill(skill: string): void {
    const current = this.selectedSkills();
    this.selectedSkills.set(current.includes(skill) ? current.filter(s => s !== skill) : [...current, skill]);
    this.profileForm.get('skills')?.markAsDirty();
  }

  isSkillSelected(skill: string): boolean {
    return this.selectedSkills().includes(skill);
  }

  addSkillFromSuggestion(skill: string): void {
    if (!this.selectedSkills().includes(skill)) {
      this.selectedSkills.set([...this.selectedSkills(), skill]);
      this.profileForm.get('skills')?.markAsDirty();
    }
    this.customSkillInput.set('');
    this.showSuggestions.set(false);
  }

  addCustomSkill(): void {
    const typed = this.customSkillInput().trim();
    if (!typed) return;

    // Réutilise l'écriture du secteur si elle existe (« java » → « Java »)
    const fromSector = this.sectorSkills().find(s => s.toLowerCase() === typed.toLowerCase());
    const skill = fromSector ?? typed;

    const current = this.selectedSkills();
    if (!current.some(s => s.toLowerCase() === skill.toLowerCase())) {
      this.selectedSkills.set([...current, skill]);
      this.profileForm.get('skills')?.markAsDirty();
    }
    // Le champ est vidé même si la compétence était déjà présente
    this.customSkillInput.set('');
    this.showSuggestions.set(false);
  }

  removeSkill(skill: string): void {
    this.selectedSkills.set(this.selectedSkills().filter(s => s !== skill));
    this.profileForm.get('skills')?.markAsDirty();
  }

  clearSkills(): void {
    if (confirm('Retirer toutes vos compétences ?')) {
      this.selectedSkills.set([]);
      this.profileForm.get('skills')?.markAsDirty();
    }
  }

  onSkillInputFocus(): void {
    if (this.filteredSuggestions().length > 0) this.showSuggestions.set(true);
  }

  onSkillInputBlur(): void {
    // Le template empêche déjà la perte de focus au clic sur une suggestion (mousedown)
    this.showSuggestions.set(false);
  }

  onSkillInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCustomSkill();
      return;
    }
    if (event.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LANGUES
  // ═══════════════════════════════════════════════════════════════════════
  addLanguage(): void {
    if (!this.canAddLanguage()) return;
    // Propose la première langue libre (souvent le français, puis l'anglais)
    const taken = new Set(this.languages().map(l => l.code));
    const firstFree = this.languageReference().languages.find(l => !taken.has(l.code))?.code ?? '';
    this.languages.update(list => [...list, { code: firstFree, level: 'B1' }]);
    this.profileForm.markAsDirty();
  }

  removeLanguage(index: number): void {
    this.languages.update(list => list.filter((_, i) => i !== index));
    this.profileForm.markAsDirty();
  }

  setLanguageCode(index: number, code: string): void {
    this.languages.update(list => list.map((l, i) => (i === index ? { ...l, code } : l)));
    this.profileForm.markAsDirty();
  }

  setLanguageLevel(index: number, level: LanguageLevel): void {
    this.languages.update(list => list.map((l, i) => (i === index ? { ...l, level } : l)));
    this.profileForm.markAsDirty();
  }

  /** Une langue déjà choisie sur une autre ligne est grisée dans la liste */
  isLanguageTaken(code: string, index: number): boolean {
    return this.languages().some((l, i) => i !== index && l.code === code);
  }

  languageLabel(code: string): string {
    return this.languageReference().languages.find(l => l.code === code)?.label ?? code;
  }

  levelLabel(level: LanguageLevel): string {
    const lv = this.levels().find(l => l.code === level);
    if (!lv) return level;
    return level === 'NATIVE' ? lv.label : `${lv.shortLabel}, ${lv.label.toLowerCase()}`;
  }

  levelDescription(level: LanguageLevel): string {
    return this.levels().find(l => l.code === level)?.description ?? '';
  }

  levelRank(level: LanguageLevel): number {
    return this.levels().find(l => l.code === level)?.rank ?? 0;
  }

  /** Accepte un tableau d'objets { code, level } venant du backend */
  private toLanguageList(raw: unknown): CandidateLanguage[] {
    if (!Array.isArray(raw)) return [];

    const result: CandidateLanguage[] = [];
    for (const item of raw as unknown[]) {
      const lang = item as Partial<CandidateLanguage> | null;
      if (lang && typeof lang.code === 'string' && typeof lang.level === 'string') {
        result.push({ code: lang.code.toLowerCase(), level: lang.level as LanguageLevel });
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FORMULAIRE
  // ═══════════════════════════════════════════════════════════════════════
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
      skills: '',
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

  // ═══════════════════════════════════════════════════════════════════════
  //  PHOTO DE PROFIL
  // ═══════════════════════════════════════════════════════════════════════
  pickProfileImage(): void {
    if (this.isOwner()) this.profileImageInput?.nativeElement.click();
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const validation = this.candidateService.isValidImageFile(file);
    if (!validation.valid) {
      this.showNotice('error', validation.error || 'Format d\'image non pris en charge.');
      return;
    }

    this.selectedProfileImage.set(file);
    this.candidateService
      .getImagePreviewUrl(file)
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

  // ═══════════════════════════════════════════════════════════════════════
  //  CV
  // ═══════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════
  //  ÉDITION & SAUVEGARDE
  // ═══════════════════════════════════════════════════════════════════════
  startEdit(): void {
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    const c = this.candidate();
    if (c) {
      this.populateForm(c);
      this.selectedSkills.set(this.toSkillList(c.skills));
      this.languages.set(this.toLanguageList(c.languages));
    }
    this.clearProfileImage();
    this.clearCV();
    this.customSkillInput.set('');
    this.showSuggestions.set(false);
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
      skills: this.selectedSkills().length > 0 ? this.selectedSkills() : undefined,
      // Toujours envoyé (même vide) pour pouvoir retirer toutes les langues
      languages: this.languages().filter(l => !!l.code),
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
        this.selectedSkills.set(this.toSkillList(data.skills));
        this.languages.set(this.toLanguageList(data.languages));
        this.populateForm(data);
        this.clearProfileImage();
        this.clearCV();
        this.customSkillInput.set('');
        this.showSuggestions.set(false);
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

  // ═══════════════════════════════════════════════════════════════════════
  //  UTILITAIRES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Le backend peut renvoyer les compétences sous forme de tableau,
   * de chaîne JSON (« ["Java","Angular"] ») ou de texte (« Java, Angular »).
   */
  private toSkillList(raw: unknown): string[] {
    const clean = (list: unknown[]) => list.map(s => String(s).trim()).filter(Boolean);
    if (Array.isArray(raw)) return clean(raw);
    if (typeof raw !== 'string' || !raw.trim()) return [];

    const text = raw.trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return clean(parsed);
      } catch { /* on tente le format texte */ }
    }
    return clean(text.split(/[,;\n]/));
  }

  sectorIcon(sector?: string | null): string {
    return (sector && SECTOR_ICONS[sector]) || SECTOR_ICONS['OTHER'];
  }

  clearSector(): void {
    this.profileForm.patchValue({ sector: '' });
    this.profileForm.get('sector')?.markAsDirty();
  }

  getSectorLabel(sector?: SectorType | string | null): string {
    if (!sector) return '';
    return cleanLabel(SECTOR_LABELS[sector as SectorType] || sector);
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

  showNotice(type: Notice['type'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ type, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), 5000);
  }

  dismissNotice(): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(null);
  }
}