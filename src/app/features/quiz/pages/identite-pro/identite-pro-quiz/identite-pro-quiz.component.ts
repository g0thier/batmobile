import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonRange,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import {
  IdentiteProPromptQuestion,
  IdentiteProSession,
} from '../../../../../core/quiz/identite-pro-session';

@Component({
  selector: 'app-identite-pro-quiz',
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonRange,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './identite-pro-quiz.component.html',
  styleUrl: './identite-pro-quiz.component.css',
})
export class IdentiteProQuizComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly identiteProSession = inject(IdentiteProSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  question: IdentiteProPromptQuestion | null = null;
  answeredCount = 0;
  totalCount = 0;
  rangeValue = 5;

  get isPerceivedIdentityQuestion(): boolean {
    return this.question?.dimension.key.trim().toLowerCase() === 'identite_percue';
  }

  constructor() {
    void this.initialize();
  }

  resolveImageUrl(rawPath: string): string {
    const normalized = rawPath.trim();
    if (!normalized) {
      return '';
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/')) {
      return normalized;
    }

    return `/${normalized.replace(/^\.?\//, '')}`;
  }

  onRangeChange(event: Event): void {
    const customEvent = event as CustomEvent<{ value?: number | null }>;
    const nextValue = Number(customEvent.detail?.value ?? this.rangeValue);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this.rangeValue = Math.max(0, Math.min(10, Math.round(nextValue)));
  }

  async onValidateTap(): Promise<void> {
    if (!this.currentUserId || !this.question || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.identiteProSession.submitAnswer(this.sessionId, this.currentUserId, {
        dimensionId: this.question.dimension.id,
        traitId: this.question.trait.id,
        themeId: this.question.trait.theme,
        responseId: this.rangeValue,
      });

      this.answeredCount = submitResult.answeredCount;

      if (submitResult.isCompleted) {
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
      this.rangeValue = 5;
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la réponse identite-pro :', error);
      this.errorMessage = "Impossible d'enregistrer ta réponse pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'identite-pro' || !this.sessionId) {
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
      console.error('Impossible de charger le quiz identite-pro :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.identiteProSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.question = prompt.question;
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
