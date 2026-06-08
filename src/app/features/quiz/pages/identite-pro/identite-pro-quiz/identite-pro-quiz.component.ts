import { Component, inject } from '@angular/core';
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
import { QuizSessionPageBase } from '../../../../../core/quiz/quiz-session-page.base';
import {
  IdentiteProPromptQuestion,
  IdentiteProSession,
  IdentiteProPromptState,
  IdentiteProSubmitAnswerResult,
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
export class IdentiteProQuizComponent extends QuizSessionPageBase<
  IdentiteProPromptState,
  IdentiteProSubmitAnswerResult
> {
  protected override readonly expectedQuizId = 'identite-pro';
  private readonly identiteProSession = inject(IdentiteProSession);

  question: IdentiteProPromptQuestion | null = null;
  rangeValue = 5;

  get isPerceivedIdentityQuestion(): boolean {
    return this.question?.dimension.key.trim().toLowerCase() === 'identite_percue';
  }

  protected override canSubmit(): boolean {
    return !!this.question;
  }

  protected override async readPromptState(): Promise<IdentiteProPromptState> {
    return this.identiteProSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: IdentiteProPromptState): void {
    this.question = prompt.question;
    this.rangeValue = 5;
  }

  protected override getAnsweredCount(prompt: IdentiteProPromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: IdentiteProSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async afterSuccessfulSubmission(_submitResult: IdentiteProSubmitAnswerResult): Promise<void> {
    this.rangeValue = 5;
  }

  protected override async submitCurrentAnswer(): Promise<IdentiteProSubmitAnswerResult> {
    if (!this.question) {
      throw new Error('Question introuvable.');
    }

    return this.identiteProSession.submitAnswer(this.sessionId, this.currentUserId, {
      dimensionId: this.question.dimension.id,
      traitId: this.question.trait.id,
      themeId: this.question.trait.theme,
      responseId: this.rangeValue,
    });
  }

  onRangeChange(event: Event): void {
    const customEvent = event as CustomEvent<{ value?: number | null }>;
    const nextValue = Number(customEvent.detail?.value ?? this.rangeValue);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this.rangeValue = Math.max(0, Math.min(10, Math.round(nextValue)));
  }
}
