import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth';
import {
  CurrentUserProfileService,
  UserProfileViewModel,
  UserSubscriptionViewModel,
} from '../../core/profile/current-user-profile';
import { ProfilePhotoPickerComponent } from './profile-photo-picker/profile-photo-picker.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [
    AsyncPipe,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    ProfilePhotoPickerComponent,
  ],
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly currentUserProfileService = inject(CurrentUserProfileService);
  private readonly router = inject(Router);

  readonly profileState$ = this.currentUserProfileService.state$;

  isSigningOut = false;
  logoutErrorMessage = '';

  onProfilePhotoCaptured(profilePicture: string): void {
    this.currentUserProfileService.setProfilePictureCache(profilePicture);
  }

  onProfilePhotoDeleted(): void {
    this.currentUserProfileService.clearProfilePictureCache();
  }

  async onSignOut(): Promise<void> {
    this.logoutErrorMessage = '';
    this.isSigningOut = true;

    try {
      await this.authService.signOut();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error: unknown) {
      this.logoutErrorMessage =
        error instanceof Error ? error.message : 'Déconnexion impossible pour le moment.';
    } finally {
      this.isSigningOut = false;
    }
  }

  getFullName(profile: UserProfileViewModel): string {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    return fullName || 'Utilisateur';
  }

  getDisplayValue(value: string): string {
    return value.trim() || 'Non renseigné';
  }

  getSubscriptionStatusLabel(subscription: UserSubscriptionViewModel): string {
    const labels: Record<string, string> = {
      active: 'Actif',
      trialing: "Période d'essai",
      past_due: 'Paiement en retard',
      canceled: 'Annulé',
      unpaid: 'Impayé',
      incomplete: 'Incomplet',
      incomplete_expired: 'Expiré',
      paused: 'En pause',
    };

    return this.getMappedLabel(subscription.status, labels);
  }

  getPaymentStatusLabel(subscription: UserSubscriptionViewModel): string {
    const labels: Record<string, string> = {
      paid: 'Paiement validé',
      failed: 'Paiement échoué',
      open: 'Paiement en attente',
      uncollectible: 'Non recouvrable',
      void: 'Annulé',
      draft: 'Brouillon',
    };

    return this.getMappedLabel(subscription.lastPaymentStatus, labels);
  }

  getRenewalLabel(subscription: UserSubscriptionViewModel): string {
    return subscription.cancelAtPeriodEnd ? "Fin d'accès" : 'Prochain renouvellement';
  }

  getRenewalDate(subscription: UserSubscriptionViewModel): string {
    const rawDate = subscription.currentPeriodEnd.trim();
    if (!rawDate) {
      return 'Non renseigné';
    }

    const numericValue = Number(rawDate);
    const parsedDate =
      Number.isFinite(numericValue) && numericValue > 0
        ? new Date(numericValue > 1_000_000_000_000 ? numericValue : numericValue * 1000)
        : new Date(rawDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return rawDate;
    }

    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(parsedDate);
  }

  private getMappedLabel(value: string, labels: Record<string, string>): string {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      return 'Non renseigné';
    }

    return labels[normalizedValue] ?? normalizedValue;
  }
}
