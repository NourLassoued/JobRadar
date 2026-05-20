import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  private authService = inject(AuthService);
  private router = inject(Router);

  // Données du formulaire
  email = '';
  password = '';

  // États (Signals)
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Veuillez remplir tous les champs');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login({ email: this.email, password: this.password })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set('Email ou mot de passe incorrect');
          console.error('Erreur login:', err);
        }
      });
  }
}