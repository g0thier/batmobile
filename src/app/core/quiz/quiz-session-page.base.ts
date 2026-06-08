import { Directive, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth';
import { QuizSessionContextService } from './quiz-session-context.service';
import type { UserQuizSessionViewModel } from './user-quiz-sessions.service';

export interface QuizPromptState {
  totalCount: number;
  isCompleted: boolean;
}

export interface QuizSubmitResult {
  isCompleted: boolean;
}

@Directive()
export abstract class QuizSessionPageBase<TPromptState extends QuizPromptState, TSubmitResult extends QuizSubmitResult>
  implements OnInit
{
  protected readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly quizSessionContextService = inject(QuizSessionContextService);

  protected currentUserId = '';
  protected currentSession: UserQuizSessionViewModel | null = null;

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  answeredCount = 0;
  totalCount = 0;

  async ngOnInit(): Promise<void> {
    await this.initialize();
  }

  async onValidateTap(): Promise<void> {
    if (!this.currentUserId || !this.canSubmit() || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.submitCurrentAnswer();
      this.answeredCount = this.getAnsweredCountFromSubmitResult(submitResult);
      await this.afterSuccessfulSubmission(submitResult);

      if (submitResult.isCompleted) {
        this.quizSessionContextService.clearCurrentSession();
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
    } catch (error: unknown) {
      console.error(`Impossible de sauvegarder la réponse ${this.quizId} :`, error);
      this.errorMessage = this.submissionErrorMessage;
    } finally {
      this.isSubmitting = false;
    }
  }

  public resolveImageUrl(rawPath: string): string {
    const normalized = rawPath.trim();
    if (!normalized) {
      return '';
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/')) {
      return normalized;
    }

    return `/${normalized.replace(/^\.?\//, '')}`;
  }

  protected abstract readonly expectedQuizId: string;

  protected get historyUrl(): string {
    return '/tabs/history';
  }

  protected get loginUrl(): string {
    return '/login';
  }

  protected get loadingErrorMessage(): string {
    return 'Impossible de charger le quiz pour le moment.';
  }

  protected get submissionErrorMessage(): string {
    return "Impossible d'enregistrer ta réponse pour le moment.";
  }

  protected abstract canSubmit(): boolean;

  protected abstract readPromptState(): Promise<TPromptState>;

  protected abstract applyPromptState(prompt: TPromptState): void;

  protected abstract submitCurrentAnswer(): Promise<TSubmitResult>;

  protected abstract getAnsweredCountFromSubmitResult(result: TSubmitResult): number;

  protected async afterPromptLoaded(_prompt: TPromptState): Promise<void> {
    return;
  }

  protected async afterSuccessfulSubmission(_submitResult: TSubmitResult): Promise<void> {
    return;
  }

  protected async goToHistory(): Promise<void> {
    await this.router.navigateByUrl(this.historyUrl, { replaceUrl: true });
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const currentSession = this.quizSessionContextService.getCurrentSession();
      if (!currentSession) {
        await this.goToHistory();
        return;
      }

      this.currentSession = currentSession;
      if (this.quizId !== this.expectedQuizId || !this.sessionId) {
        this.quizSessionContextService.clearCurrentSession();
        await this.goToHistory();
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl(this.loginUrl, { replaceUrl: true });
        return;
      }

      this.currentUserId = userId;
      await this.loadPrompt();
    } catch (error: unknown) {
      console.error(`Impossible de charger le quiz ${this.quizId} :`, error);
      this.errorMessage = this.loadingErrorMessage;
    } finally {
      this.isLoading = false;
    }
  }

  protected get sessionId(): string {
    return this.currentSession?.sessionId.trim() ?? '';
  }

  protected get quizId(): string {
    return this.currentSession?.quizId.trim().toLowerCase() ?? '';
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.readPromptState();
    this.applyPromptState(prompt);
    this.totalCount = prompt.totalCount;
    this.answeredCount = this.getAnsweredCount(prompt);
    await this.afterPromptLoaded(prompt);

    if (prompt.isCompleted) {
      this.quizSessionContextService.clearCurrentSession();
      await this.goToHistory();
    }
  }

  protected abstract getAnsweredCount(prompt: TPromptState): number;
}
