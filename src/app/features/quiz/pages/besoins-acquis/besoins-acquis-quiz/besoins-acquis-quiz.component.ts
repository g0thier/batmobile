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
  BesoinsAcquisQuestion,
  BesoinsAcquisReponse,
  BesoinsAcquisSession,
} from '../../../../../core/quiz/besoins-acquis-session';

@Component({
  selector: 'app-besoins-acquis-quiz',
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
  templateUrl: './besoins-acquis-quiz.component.html',
  styleUrl: './besoins-acquis-quiz.component.css',
})
export class BesoinsAcquisQuizComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly besoinsAcquisSession = inject(BesoinsAcquisSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  private currentUserId = '';

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';
  question: BesoinsAcquisQuestion | null = null;
  responses: BesoinsAcquisReponse[] = [];
  selectedResponseId: number | null = null;
  answeredCount = 0;
  totalCount = 0;

  constructor() {
    void this.initialize();
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
      const submitResult = await this.besoinsAcquisSession.submitAnswer(this.sessionId, this.currentUserId, {
        questionId: this.question.id,
        reponseId: this.selectedResponseId,
        besoinId: this.question.besoin,
      });

      this.answeredCount = submitResult.answeredCount;

      if (submitResult.isCompleted) {
        await this.goToHistory();
        return;
      }

      await this.loadPrompt();
    } catch (error: unknown) {
      console.error('Impossible de sauvegarder la réponse besoins-acquis :', error);
      this.errorMessage = "Impossible d'enregistrer ta réponse pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'besoins-acquis' || !this.sessionId) {
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
      console.error('Impossible de charger le quiz besoins-acquis :', error);
      this.errorMessage = 'Impossible de charger le quiz pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPrompt(): Promise<void> {
    const prompt = await this.besoinsAcquisSession.getPromptForSession(this.sessionId, this.currentUserId);
    this.question = prompt.question;
    this.responses = prompt.reponses;
    this.totalCount = prompt.totalCount;
    this.answeredCount = prompt.answeredCount;
    this.selectedResponseId = this.getDefaultResponseId(prompt.reponses);

    if (prompt.isCompleted) {
      await this.goToHistory();
    }
  }

  private getDefaultResponseId(reponses: BesoinsAcquisReponse[]): number | null {
    const ouiResponse = reponses.find((reponse) => reponse.label.trim().toLowerCase() === 'oui');
    if (ouiResponse) {
      return ouiResponse.id;
    }

    return reponses[0]?.id ?? null;
  }

  private async goToHistory(): Promise<void> {
    await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
  }
}
