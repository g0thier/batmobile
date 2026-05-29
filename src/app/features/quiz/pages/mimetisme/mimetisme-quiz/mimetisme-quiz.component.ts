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
import { MimetismeModele, MimetismePromptPair, MimetismeSession } from '../../../../../core/quiz/mimetisme-session';

@Component({
  selector: 'app-mimetisme-quiz',
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
  templateUrl: './mimetisme-quiz.component.html',
  styleUrl: './mimetisme-quiz.component.css',
})
export class MimetismeQuizComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly mimetismeSession = inject(MimetismeSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';
  private readonly brokenPortraitIds = new Set<number>();

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  pair: MimetismePromptPair | null = null;
  rankedCount = 0;
  totalCount = 0;
  comparisonsCount = 0;

  constructor() {
    void this.initialize();
  }

  async onChoiceTap(preferred: MimetismeModele, other: MimetismeModele): Promise<void> {
    if (!this.currentUserId || !this.pair || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const submitResult = await this.mimetismeSession.submitChoice(this.sessionId, this.currentUserId, {
        preferredModelId: preferred.id,
        otherModelId: other.id,
      });

      this.rankedCount = submitResult.rankedCount;
      this.comparisonsCount = submitResult.comparisonsCount;

      if (submitResult.isCompleted) {
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la préférence mimetisme :', error);
      this.errorMessage = "Impossible d'enregistrer ta préférence pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async onChoiceKeyDown(event: KeyboardEvent, preferred: MimetismeModele, other: MimetismeModele): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onChoiceTap(preferred, other);
  }

  onPortraitError(modelId: number): void {
    this.brokenPortraitIds.add(modelId);
  }

  hasPortrait(modelId: number): boolean {
    return !this.brokenPortraitIds.has(modelId);
  }

  resolvePortraitUrl(rawPath: string): string {
    const normalized = rawPath.trim();
    if (!normalized) {
      return '';
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/')) {
      return normalized;
    }

    if (normalized.startsWith('src/module/')) {
      return `/${normalized.slice('src/'.length)}`;
    }

    return `/${normalized.replace(/^\.?\//, '')}`;
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'mimetisme' || !this.sessionId) {
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
      console.error('Impossible de charger le quiz mimetisme :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.mimetismeSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.pair = prompt.pair;
    this.totalCount = prompt.totalCount;
    this.rankedCount = prompt.rankedCount;
    this.comparisonsCount = prompt.comparisonsCount;

    if (prompt.isCompleted) {
      await this.goToHistory();
    }
  }

  private async goToHistory(): Promise<void> {
    await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
  }

}
