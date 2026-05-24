import { inject, Injectable } from '@angular/core';
import {
  Auth,
  authState,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from '@angular/fire/auth';
import { FirebaseError } from 'firebase/app';
import { map, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);

  readonly authUser$ = authState(this.auth).pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  readonly isAuthenticated$ = this.authUser$.pipe(map((user) => Boolean(user)));

  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error: unknown) {
      throw new Error(this.mapSignInError(error));
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: unknown) {
      if (error instanceof FirebaseError && error.code === 'auth/user-not-found') {
        return;
      }

      throw new Error(this.mapResetPasswordError(error));
    }
  }

  private mapSignInError(error: unknown): string {
    if (!(error instanceof FirebaseError)) {
      return 'Connexion impossible pour le moment.';
    }

    switch (error.code) {
      case 'auth/invalid-email':
        return 'Adresse email invalide.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email ou mot de passe incorrect.';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Réessaie dans quelques minutes.';
      case 'auth/network-request-failed':
        return 'Problème réseau. Vérifie ta connexion internet.';
      default:
        return 'Connexion impossible pour le moment.';
    }
  }

  private mapResetPasswordError(error: unknown): string {
    if (!(error instanceof FirebaseError)) {
      return "Impossible d'envoyer l'email de réinitialisation.";
    }

    switch (error.code) {
      case 'auth/invalid-email':
        return 'Adresse email invalide.';
      case 'auth/too-many-requests':
        return 'Trop de demandes. Réessaie dans quelques minutes.';
      case 'auth/network-request-failed':
        return 'Problème réseau. Vérifie ta connexion internet.';
      default:
        return "Impossible d'envoyer l'email de réinitialisation.";
    }
  }
}
