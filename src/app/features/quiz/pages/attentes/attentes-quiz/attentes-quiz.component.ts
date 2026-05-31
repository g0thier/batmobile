import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import {
  AttentesPromptQuestion,
  AttentesReponse,
  AttentesSession,
} from '../../../../../core/quiz/attentes-session';

@Component({
  selector: 'app-attentes-quiz',
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './attentes-quiz.component.html',
  styleUrl: './attentes-quiz.component.css',
})
export class AttentesQuizComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly attentesSession = inject(AttentesSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  question: AttentesPromptQuestion | null = null;
  responses: AttentesReponse[] = [];
  selectedResponseId: number | null = null;
  answeredCount = 0;
  totalCount = 0;

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

  onResponseChange(event: Event): void {
    const customEvent = event as CustomEvent<{ value?: number | string | null }>;
    const rawValue = customEvent.detail?.value;
    const nextValue = Number(rawValue);

    if (!Number.isFinite(nextValue)) {
      return;
    }

    if (!this.responses.some((response) => response.id === nextValue)) {
      return;
    }

    this.selectedResponseId = nextValue;
  }

  async onValidateTap(): Promise<void> {
    if (!this.currentUserId || !this.question || this.selectedResponseId === null || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.attentesSession.submitAnswer(this.sessionId, this.currentUserId, {
        facteurId: this.question.facteur.id,
        affirmationId: this.question.affirmation.id,
        attenteId: this.question.affirmation.attente,
        reponseId: this.selectedResponseId,
      });

      this.answeredCount = submitResult.answeredCount;

      if (submitResult.isCompleted) {
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la réponse attentes :', error);
      this.errorMessage = "Impossible d'enregistrer ta réponse pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'attentes' || !this.sessionId) {
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
      console.error('Impossible de charger le quiz attentes :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.attentesSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.question = prompt.question;
    this.totalCount = prompt.totalCount;
    this.answeredCount = prompt.answeredCount;
    this.responses = prompt.question?.facteur.reponses ?? [];
    this.selectedResponseId = this.getDefaultResponseId(this.responses);

    if (prompt.isCompleted) {
      await this.goToHistory();
    }
  }

  private getDefaultResponseId(reponses: AttentesReponse[]): number | null {
    const defaultResponse = reponses.find((reponse) => reponse.id === 2);
    if (defaultResponse) {
      return defaultResponse.id;
    }

    return reponses[0]?.id ?? null;
  }

  private async goToHistory(): Promise<void> {
    await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
  }
}
