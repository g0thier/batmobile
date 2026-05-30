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
import { EquiteOpposition, EquiteSession } from '../../../../../core/quiz/equite-session';

@Component({
  selector: 'app-equite-quiz',
  standalone: true,
  imports: [IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonRange, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './equite-quiz.component.html',
  styleUrl: './equite-quiz.component.css',
})
export class EquiteQuizComponent {
  private static readonly IMAGE_SCALE_AMPLITUDE = 0.2;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly equiteSession = inject(EquiteSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  opposition: EquiteOpposition | null = null;
  answeredCount = 0;
  totalCount = 0;
  rangeValue = 5;

  constructor() {
    void this.initialize();
  }

  get responseId(): number {
    return this.rangeValue - 5;
  }

  get contributionsScore(): number {
    return 5 - this.responseId;
  }

  get retributionsScore(): number {
    return 5 + this.responseId;
  }

  get leftImageTransform(): string {
    return `scale(${this.computeImageScale(-1).toFixed(2)})`;
  }

  get rightImageTransform(): string {
    return `scale(${this.computeImageScale(1).toFixed(2)})`;
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

    const boundedValue = Math.max(0, Math.min(10, Math.round(nextValue)));
    this.rangeValue = boundedValue;
  }

  async onValidateTap(): Promise<void> {
    if (!this.currentUserId || !this.opposition || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.equiteSession.submitAnswer(this.sessionId, this.currentUserId, {
        oppositionId: this.opposition.id,
        themeId: this.opposition.theme,
        responseId: this.responseId,
      });

      this.answeredCount = submitResult.answeredCount;

      if (submitResult.isCompleted) {
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
      this.rangeValue = 5;
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la réponse equite :', error);
      this.errorMessage = "Impossible d'enregistrer ta réponse pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'equite' || !this.sessionId) {
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
      console.error('Impossible de charger le quiz equite :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.equiteSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.opposition = prompt.opposition;
    this.totalCount = prompt.totalCount;
    this.answeredCount = prompt.answeredCount;

    if (prompt.isCompleted) {
      await this.goToHistory();
    }
  }

  private async goToHistory(): Promise<void> {
    await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
  }

  private computeImageScale(direction: -1 | 1): number {
    const normalizedOffset = (this.rangeValue - 5) / 5;
    const scale = 1 + normalizedOffset * direction * EquiteQuizComponent.IMAGE_SCALE_AMPLITUDE;
    return Math.max(0.8, Math.min(1.2, scale));
  }
}
