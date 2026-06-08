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
  AutodeterminationAffirmation,
  AutodeterminationSession,
  AutodeterminationPromptState,
  AutodeterminationSubmitAnswerResult,
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
export class AutodeterminationQuizComponent extends QuizSessionPageBase<
  AutodeterminationPromptState,
  AutodeterminationSubmitAnswerResult
> {
  protected override readonly expectedQuizId = 'autodetermination';
  private readonly autodeterminationSession = inject(AutodeterminationSession);

  affirmation: AutodeterminationAffirmation | null = null;
  selectedResponseId: 1 | 2 | null = null;

  protected override canSubmit(): boolean {
    return !!this.affirmation && this.selectedResponseId !== null;
  }

  protected override async readPromptState(): Promise<AutodeterminationPromptState> {
    return this.autodeterminationSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: AutodeterminationPromptState): void {
    this.affirmation = prompt.affirmation;
    this.selectedResponseId = null;
  }

  protected override getAnsweredCount(prompt: AutodeterminationPromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: AutodeterminationSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async submitCurrentAnswer(): Promise<AutodeterminationSubmitAnswerResult> {
    if (!this.affirmation || this.selectedResponseId === null) {
      throw new Error('Affirmation ou réponse introuvable.');
    }

    return this.autodeterminationSession.submitAnswer(this.sessionId, this.currentUserId, {
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
