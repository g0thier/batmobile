import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
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
  AutodeterminationAffirmation,
  AutodeterminationSession,
} from '../../../../../core/quiz/autodetermination-session';

@Component({
  selector: 'app-autodetermination-quiz',
  standalone: true,
  imports: [
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './autodetermination-quiz.component.html',
  styleUrl: './autodetermination-quiz.component.css',
})
export class AutodeterminationQuizComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly autodeterminationSession = inject(AutodeterminationSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  affirmation: AutodeterminationAffirmation | null = null;
  answeredCount = 0;
  totalCount = 0;

  constructor() {
    void this.initialize();
  }

  async onChoiceTap(responseId: 1 | 2): Promise<void> {
    if (!this.currentUserId || !this.affirmation || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.autodeterminationSession.submitAnswer(this.sessionId, this.currentUserId, {
        affirmationId: this.affirmation.id,
        themeId: this.affirmation.theme,
        responseId,
      });

      this.answeredCount = submitResult.answeredCount;

      if (submitResult.isCompleted) {
        await this.goToNextSessionOrHistory();
        return;
      }

      await this.loadPrompt();
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la réponse autodetermination :', error);
      this.errorMessage = "Impossible d'enregistrer ta réponse pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async onChoiceKeyDown(event: KeyboardEvent, responseId: 1 | 2): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onChoiceTap(responseId);
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'autodetermination' || !this.sessionId) {
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
      console.error('Impossible de charger le quiz autodetermination :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.autodeterminationSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.affirmation = prompt.affirmation;
    this.totalCount = prompt.totalCount;
    this.answeredCount = prompt.answeredCount;

    if (prompt.isCompleted) {
      await this.goToNextSessionOrHistory();
    }
  }

  private async goToNextSessionOrHistory(): Promise<void> {
    const nextSession = await this.autodeterminationSession.pickRandomNextEligibleSession(
      this.currentUserId,
      this.sessionId,
    );

    if (!nextSession) {
      await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      return;
    }

    await this.router.navigateByUrl(
      `/tabs/quiz-session/${nextSession.quizId}/${nextSession.sessionId}`,
      { replaceUrl: true },
    );
  }
}
