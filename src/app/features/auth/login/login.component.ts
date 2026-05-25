import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonInput,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../core/auth/auth';
// import { MaterialIconComponent } from '../../../shared/material-icon/material-icon.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonInput,
    IonSpinner,
    IonText,
    // MaterialIconComponent,
  ],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  step = 1;
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  onSubmit(): void {
    this.errorMessage = '';

    if (this.step === 1) {
      const trimmedEmail = this.email.trim();
      if (!this.isValidEmail(trimmedEmail)) {
        this.errorMessage = 'Saisis une adresse email valide.';
        return;
      }

      this.email = trimmedEmail;
      this.step = 2;
      return;
    }

    void this.signIn();
  }

  backToEmail(): void {
    this.step = 1;
    this.password = '';
    this.errorMessage = '';
  }

  private async signIn(): Promise<void> {
    if (!this.password.trim()) {
      this.errorMessage = 'Saisis ton mot de passe.';
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.signInWithEmail(this.email, this.password);
      await this.router.navigateByUrl('/tabs/quiz', { replaceUrl: true });
    } catch (error: unknown) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Connexion impossible pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
