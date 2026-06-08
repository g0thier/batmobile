import { Component, inject } from '@angular/core';
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
import { QuizSessionPageBase } from '../../../../../core/quiz/quiz-session-page.base';
import {
  TheorieXYAffirmation,
  TheorieXYSession,
  TheorieXYPromptState,
  TheorieXYSubmitAnswerResult,
} from '../../../../../core/quiz/theorie-x-y-session';

@Component({
  selector: 'app-theorie-x-y-quiz',
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
  templateUrl: './theorie-x-y-quiz.component.html',
  styleUrl: './theorie-x-y-quiz.component.css',
})
export class TheorieXYQuizComponent extends QuizSessionPageBase<
  TheorieXYPromptState,
  TheorieXYSubmitAnswerResult
> {
  protected override readonly expectedQuizId = 'theorie-x-y';
  private readonly theorieXYSession = inject(TheorieXYSession);

  affirmation: TheorieXYAffirmation | null = null;
  selectedResponseId: 1 | 2 | null = null;

  protected override canSubmit(): boolean {
    return !!this.affirmation && this.selectedResponseId !== null;
  }

  protected override async readPromptState(): Promise<TheorieXYPromptState> {
    return this.theorieXYSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: TheorieXYPromptState): void {
    this.affirmation = prompt.affirmation;
    this.selectedResponseId = null;
  }

  protected override getAnsweredCount(prompt: TheorieXYPromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: TheorieXYSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async submitCurrentAnswer(): Promise<TheorieXYSubmitAnswerResult> {
    if (!this.affirmation || this.selectedResponseId === null) {
      throw new Error('Affirmation ou réponse introuvable.');
    }

    return this.theorieXYSession.submitAnswer(this.sessionId, this.currentUserId, {
      affirmationId: this.affirmation.id,
      themeId: this.affirmation.theme,
      responseId: this.selectedResponseId,
    });
  }

  async onChoiceTap(responseId: 1 | 2): Promise<void> {
    if (!this.affirmation) {
      return;
    }

    this.selectedResponseId = responseId;
    await this.onValidateTap();
  }

  async onChoiceKeyDown(event: KeyboardEvent, responseId: 1 | 2): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onChoiceTap(responseId);
  }
}
