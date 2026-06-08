import { Component, inject } from '@angular/core';
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
import {
  QuizSessionPageBase,
} from '../../../../../core/quiz/quiz-session-page.base';
import {
  AttentesPromptQuestion,
  AttentesReponse,
  AttentesSession,
  AttentesPromptState,
  AttentesSubmitAnswerResult,
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
export class AttentesQuizComponent extends QuizSessionPageBase<AttentesPromptState, AttentesSubmitAnswerResult> {
  protected override readonly expectedQuizId = 'attentes';
  private readonly attentesSession = inject(AttentesSession);

  question: AttentesPromptQuestion | null = null;
  responses: AttentesReponse[] = [];
  selectedResponseId: number | null = null;

  protected override canSubmit(): boolean {
    return !!this.question && this.selectedResponseId !== null;
  }

  protected override async readPromptState(): Promise<AttentesPromptState> {
    return this.attentesSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: AttentesPromptState): void {
    this.question = prompt.question;
    this.responses = prompt.question?.facteur.reponses ?? [];
    this.selectedResponseId = this.getDefaultResponseId(this.responses);
  }

  protected override getAnsweredCount(prompt: AttentesPromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: AttentesSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async submitCurrentAnswer(): Promise<AttentesSubmitAnswerResult> {
    if (!this.question || this.selectedResponseId === null) {
      throw new Error('Question ou réponse introuvable.');
    }

    return this.attentesSession.submitAnswer(this.sessionId, this.currentUserId, {
      facteurId: this.question.facteur.id,
      affirmationId: this.question.affirmation.id,
      attenteId: this.question.affirmation.attente,
      reponseId: this.selectedResponseId,
    });
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

  private getDefaultResponseId(reponses: AttentesReponse[]): number | null {
    const defaultResponse = reponses.find((reponse) => reponse.id === 2);
    if (defaultResponse) {
      return defaultResponse.id;
    }

    return reponses[0]?.id ?? null;
  }
}
