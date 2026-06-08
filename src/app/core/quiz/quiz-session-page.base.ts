import { Directive, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth';

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
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  protected readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  protected readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  protected currentUserId = '';

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
      if (this.quizId !== this.expectedQuizId || !this.sessionId) {
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

  private async loadPrompt(): Promise<void> {
    const prompt = await this.readPromptState();
    this.applyPromptState(prompt);
    this.totalCount = prompt.totalCount;
    this.answeredCount = this.getAnsweredCount(prompt);
    await this.afterPromptLoaded(prompt);

    if (prompt.isCompleted) {
      await this.goToHistory();
    }
  }

  protected abstract getAnsweredCount(prompt: TPromptState): number;
}
