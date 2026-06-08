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
  EquiteOpposition,
  EquiteSession,
  EquitePromptState,
  EquiteSubmitAnswerResult,
} from '../../../../../core/quiz/equite-session';

@Component({
  selector: 'app-equite-quiz',
  standalone: true,
  imports: [IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonRange, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './equite-quiz.component.html',
  styleUrl: './equite-quiz.component.css',
})
export class EquiteQuizComponent extends QuizSessionPageBase<EquitePromptState, EquiteSubmitAnswerResult> {
  private static readonly IMAGE_SCALE_AMPLITUDE = 0.2;
  protected override readonly expectedQuizId = 'equite';
  private readonly equiteSession = inject(EquiteSession);

  opposition: EquiteOpposition | null = null;
  rangeValue = 5;

  protected override canSubmit(): boolean {
    return !!this.opposition;
  }

  protected override async readPromptState(): Promise<EquitePromptState> {
    return this.equiteSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: EquitePromptState): void {
    this.opposition = prompt.opposition;
    this.rangeValue = 5;
  }

  protected override getAnsweredCount(prompt: EquitePromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: EquiteSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async afterSuccessfulSubmission(_submitResult: EquiteSubmitAnswerResult): Promise<void> {
    this.rangeValue = 5;
  }

  protected override async submitCurrentAnswer(): Promise<EquiteSubmitAnswerResult> {
    if (!this.opposition) {
      throw new Error('Opposition introuvable.');
    }

    return this.equiteSession.submitAnswer(this.sessionId, this.currentUserId, {
      oppositionId: this.opposition.id,
      themeId: this.opposition.theme,
      responseId: this.responseId,
    });
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

  onRangeChange(event: Event): void {
    const customEvent = event as CustomEvent<{ value?: number | null }>;
    const nextValue = Number(customEvent.detail?.value ?? this.rangeValue);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    const boundedValue = Math.max(0, Math.min(10, Math.round(nextValue)));
    this.rangeValue = boundedValue;
  }

  private computeImageScale(direction: -1 | 1): number {
    const normalizedOffset = (this.rangeValue - 5) / 5;
    const scale = 1 + normalizedOffset * direction * EquiteQuizComponent.IMAGE_SCALE_AMPLITUDE;
    return Math.max(0.8, Math.min(1.2, scale));
  }
}
