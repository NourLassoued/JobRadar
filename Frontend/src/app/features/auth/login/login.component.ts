import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SECTOR_ICONS, sectorLabel } from '../../../core/models/sector.utils';

/** Durée d'un tour de radar (doit correspondre à --sweep dans le SCSS) */
const SWEEP_SECONDS = 6;

@Component({
  selector: 'jr-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  loadingGoogle = signal(false);
  loadingLinkedIn = signal(false);
  showPassword = signal(false);
  rememberMe = signal(true);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /**
   * Secteurs affichés comme « échos » sur le radar du panneau gauche.
   * Chaque écho s'allume quand le balayage passe dessus.
   */
  readonly blips = ['TECH', 'HEALTH', 'BTP', 'TRANSPORT', 'COMMERCE', 'EDUCATION', 'BANKING', 'HOSPITALITY']
    .map((code, i, arr) => {
      const angle = (360 / arr.length) * i + 20;          // degrés, sens horaire depuis le haut
      const radius = i % 2 ? 26 : 40;                     // % du rayon du radar
      const rad = (angle * Math.PI) / 180;
      // Le bord lumineux du balayage est à +60° : l'écho s'allume quand il l'atteint
      const hit = (((angle - 60 + 360) % 360) / 360) * SWEEP_SECONDS;
      return {
        code,
        label: sectorLabel(code),
        icon: SECTOR_ICONS[code],
        x: 50 + radius * Math.sin(rad),
        y: 50 - radius * Math.cos(rad),
        delay: `${(hit - SWEEP_SECONDS).toFixed(2)}s`,
      };
    });

  // ── Raccourcis template ────────────────────────────────────
  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }

  showError(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleRemember(event: Event): void {
    this.rememberMe.set((event.target as HTMLInputElement).checked);
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

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.status === 0
            ? 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.'
            : err?.error?.message ?? 'Email ou mot de passe incorrect.'
        );
      },
    });
  }
}