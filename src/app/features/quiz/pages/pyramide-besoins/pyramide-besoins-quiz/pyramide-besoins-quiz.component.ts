import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import {
  PyramideBesoinsAffirmation,
  PyramideBesoinsReponse,
  PyramideBesoinsSession,
} from '../../../../../core/quiz/pyramide-besoins-session';

@Component({
  selector: 'app-pyramide-besoins-quiz',
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './pyramide-besoins-quiz.component.html',
  styleUrl: './pyramide-besoins-quiz.component.css',
})
export class PyramideBesoinsQuizComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly pyramideBesoinsSession = inject(PyramideBesoinsSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  affirmation: PyramideBesoinsAffirmation | null = null;
  reponses: PyramideBesoinsReponse[] = [];
  answeredCount = 0;
  totalCount = 0;

  constructor() {
    void this.initialize();
  }

  async onChoiceTap(reponseId: number): Promise<void> {
    if (!this.currentUserId || !this.affirmation || this.isSubmitting) {
      return;
    }

    if (!this.reponses.some((reponse) => reponse.id === reponseId)) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.pyramideBesoinsSession.submitAnswer(this.sessionId, this.currentUserId, {
        affirmationId: this.affirmation.id,
        reponseId,
        besoinId: this.affirmation.besoin,
      });

      this.answeredCount = submitResult.answeredCount;

      if (submitResult.isCompleted) {
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la réponse pyramide-besoins :', error);
      this.errorMessage = "Impossible d'enregistrer ta réponse pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async onChoiceKeyDown(event: KeyboardEvent, reponseId: number): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onChoiceTap(reponseId);
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'pyramide-besoins' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.currentUserId = userId;
      await this.loadPrompt();
    } catch (error: unknown) {
      console.error('Impossible de charger le quiz pyramide-besoins :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.pyramideBesoinsSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.affirmation = prompt.affirmation;
    this.reponses = prompt.reponses;
    this.totalCount = prompt.totalCount;
    this.answeredCount = prompt.answeredCount;

    if (prompt.isCompleted) {
      await this.goToHistory();
    }
  }

  private async goToHistory(): Promise<void> {
    await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
  }
}
