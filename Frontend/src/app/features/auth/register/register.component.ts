import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'jr-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  loadingGoogle = signal(false);
  loadingLinkedIn = signal(false);
  showPassword = signal(false);
  errorMessage = signal<string | null>(null);
  emailTaken = signal(false);

  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    acceptTerms: [false, [Validators.requiredTrue]],
  });

  // ── Valeurs en direct (pour l'aperçu du panneau droit) ─────
  private value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private passwordValue = computed(() => this.value().password || '');

  previewName = computed(() => {
    const v = this.value();
    return [v.firstName?.trim(), v.lastName?.trim()].filter(Boolean).join(' ');
  });

  previewInitials = computed(() => {
    const v = this.value();
    const i = (v.firstName?.trim().charAt(0) || '') + (v.lastName?.trim().charAt(0) || '');
    return i.toUpperCase();
  });

  previewEmail = computed(() => {
    const email = this.value().email?.trim() || '';
    return this.form.controls.email.valid ? email : '';
  });

  /** Étapes du compte, cochées au fil de la saisie */
  readiness = computed(() => {
    const v = this.value();
    const c = this.form.controls;
    return [
      { label: 'Prénom et nom', done: c.firstName.valid && c.lastName.valid },
      { label: 'Adresse e-mail valide', done: c.email.valid },
      { label: 'Mot de passe solide', done: c.password.valid && this.passwordStrength() >= 3 },
      { label: 'Conditions acceptées', done: !!v.acceptTerms },
    ];
  });

  readinessPercent = computed(() => {
    const r = this.readiness();
    return Math.round((r.filter(x => x.done).length / r.length) * 100);
  });

  // ── Force du mot de passe ──────────────────────────────────

  passwordRules = computed(() => {
    const pwd = this.passwordValue() || '';
    return [
      { label: '8 caractères', ok: pwd.length >= 8 },
      { label: 'une majuscule', ok: /[A-Z]/.test(pwd) },
      { label: 'un chiffre', ok: /[0-9]/.test(pwd) },
      { label: 'un symbole', ok: /[^A-Za-z0-9]/.test(pwd) },
    ];
  });

  passwordStrength = computed(() => this.passwordRules().filter(r => r.ok).length);
  hasPassword = computed(() => (this.passwordValue() || '').length > 0);

  strengthLabel = computed(() =>
    ['Trop faible', 'Faible', 'Moyen', 'Bon', 'Excellent'][this.passwordStrength()]
  );

  missingRules = computed(() => this.passwordRules().filter(r => !r.ok).map(r => r.label));

  // ── Helpers template ───────────────────────────────────────
  showError(name: 'firstName' | 'lastName' | 'email' | 'password' | 'acceptTerms'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  loginWithGoogle(): void {
    this.loadingGoogle.set(true);
    this.auth.loginWithGoogle();
  }

  loginWithLinkedIn(): void {
    this.loadingLinkedIn.set(true);
    this.auth.loginWithLinkedIn();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.emailTaken.set(false);

    const { acceptTerms, ...payload } = this.form.getRawValue();

    this.auth.register(payload).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: err => {
        this.loading.set(false);
        if (err?.status === 409) {
          this.emailTaken.set(true);
          this.errorMessage.set('Un compte existe déjà avec cette adresse e-mail.');
        } else if (err?.status === 0) {
          this.errorMessage.set('Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.');
        } else {
          this.errorMessage.set(err?.error?.message ?? 'L\'inscription a échoué. Vérifiez vos informations puis réessayez.');
        }
      },
    });
  }
}