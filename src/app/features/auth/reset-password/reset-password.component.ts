import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
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
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);

  email = '';
  sent = false;
  isLoading = false;
  errorMessage = '';

  onSubmit(): void {
    this.errorMessage = '';
    const trimmedEmail = this.email.trim();

    if (!this.isValidEmail(trimmedEmail)) {
      this.errorMessage = 'Saisis une adresse email valide.';
      return;
    }

    this.email = trimmedEmail;
    void this.sendResetEmail();
  }

  private async sendResetEmail(): Promise<void> {
    this.isLoading = true;

    try {
      await this.authService.resetPassword(this.email);
      this.sent = true;
    } catch (error: unknown) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer l'email de réinitialisation.";
    } finally {
      this.isLoading = false;
    }
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
