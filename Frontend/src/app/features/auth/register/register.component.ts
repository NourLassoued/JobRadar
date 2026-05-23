import { Component, inject, signal } from '@angular/core';
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
  showPassword = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName:  ['', [Validators.required, Validators.maxLength(100)]],
    email:     ['', [Validators.required, Validators.email]],
    password:  ['', [Validators.required, Validators.minLength(8)]],
    acceptTerms: [false, [Validators.requiredTrue]],
  });

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
loginWithGoogle(): void {
  this.auth.loginWithGoogle();
}

loginWithLinkedIn(): void {
  this.auth.loginWithLinkedIn();
}
  // Indicateur visuel de la force du mot de passe (0-4)
  passwordStrength(): number {
    const pwd = this.form.controls.password.value ?? '';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }


    this.loading.set(true);
    this.errorMessage.set(null);

    const { acceptTerms, ...payload } = this.form.getRawValue();

    this.auth.register(payload).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'Inscription impossible. Vérifiez vos informations.'
        );
      },
    });
  }
}