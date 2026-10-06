import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Délai avant de pouvoir renvoyer l'email (secondes) */
const RESEND_DELAY = 60;

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  /** Adresse à laquelle l'email a été envoyé : affiche l'écran de confirmation */
  sentTo = signal<string | null>(null);
  resendIn = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  get email() {
    return this.form.controls.email;
  }

  showError(control: 'email'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.send(this.form.getRawValue().email.trim());
  }

  resend(): void {
    const email = this.sentTo();
    if (email && this.resendIn() === 0) this.send(email);
  }

  /** Revenir au formulaire pour corriger l'adresse */
  changeEmail(): void {
    this.form.setValue({ email: this.sentTo() || '' });
    this.sentTo.set(null);
    this.errorMessage.set(null);
  }

  private send(email: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sentTo.set(email);
        this.startCooldown();
      },
      error: (err: any) => {
        this.loading.set(false);
        if (err?.status === 0) {
          this.errorMessage.set('Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.');
        } else if (err?.status === 429) {
          this.errorMessage.set('Trop de demandes. Patientez quelques minutes avant de réessayer.');
        } else {
          this.errorMessage.set(err?.error?.message || 'L\'envoi a échoué. Réessayez dans un instant.');
        }
      },
    });
  }

  private startCooldown(): void {
    clearInterval(this.timer);
    this.resendIn.set(RESEND_DELAY);
    this.timer = setInterval(() => {
      const next = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, next));
      if (next <= 0) clearInterval(this.timer);
    }, 1000);
  }
}