import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Même règle que le backend : 8 caractères, une majuscule, une minuscule, un chiffre */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/** Secondes avant la redirection vers la connexion après succès */
const REDIRECT_DELAY = 4;

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pwd = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { mismatch: true } : null;
};

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private token: string | null = null;
  private timer?: ReturnType<typeof setInterval>;

  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal<string | null>(null);
  invalidToken = signal(false);
  success = signal(false);
  redirectIn = signal(REDIRECT_DELAY);

  form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  // ── Règles du mot de passe (mises à jour pendant la saisie) ─
  private value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private pwd = computed(() => this.value().newPassword || '');

  rules = computed(() => {
    const p = this.pwd();
    return [
      { label: '8 caractères minimum', ok: p.length >= 8 },
      { label: 'Une majuscule', ok: /[A-Z]/.test(p) },
      { label: 'Une minuscule', ok: /[a-z]/.test(p) },
      { label: 'Un chiffre', ok: /\d/.test(p) },
    ];
  });

  strength = computed(() => this.rules().filter(r => r.ok).length);
  hasPassword = computed(() => this.pwd().length > 0);
  strengthLabel = computed(() => ['Trop faible', 'Faible', 'Moyen', 'Presque', 'Solide'][this.strength()]);

  confirmState = computed<'empty' | 'match' | 'mismatch'>(() => {
    const confirm = this.value().confirmPassword || '';
    if (!confirm) return 'empty';
    return confirm === this.pwd() ? 'match' : 'mismatch';
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) this.invalidToken.set(true);
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  showError(name: 'newPassword' | 'confirmPassword'): boolean {
    const c = this.form.controls[name];
    if (name === 'confirmPassword') return c.touched && (c.invalid || this.confirmState() === 'mismatch');
    return c.invalid && c.touched;
  }

  submit(): void {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.resetPassword(this.token, this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.startRedirect();
      },
      error: (err: any) => {
        this.loading.set(false);
        if ([400, 401, 403, 410].includes(err?.status)) {
          this.invalidToken.set(true);
        } else if (err?.status === 0) {
          this.errorMessage.set('Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.');
        } else {
          this.errorMessage.set(err?.error?.message || 'La modification a échoué. Réessayez dans un instant.');
        }
      },
    });
  }

  goToLogin(): void {
    clearInterval(this.timer);
    this.router.navigate(['/auth/login']);
  }

  private startRedirect(): void {
    this.redirectIn.set(REDIRECT_DELAY);
    this.timer = setInterval(() => {
      const next = this.redirectIn() - 1;
      this.redirectIn.set(Math.max(0, next));
      if (next <= 0) this.goToLogin();
    }, 1000);
  }
}