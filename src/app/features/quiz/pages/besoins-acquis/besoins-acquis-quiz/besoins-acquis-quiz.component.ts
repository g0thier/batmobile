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
import { QuizSessionPageBase } from '../../../../../core/quiz/quiz-session-page.base';
import {
  BesoinsAcquisQuestion,
  BesoinsAcquisReponse,
  BesoinsAcquisSession,
  BesoinsAcquisPromptState,
  BesoinsAcquisSubmitAnswerResult,
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
export class BesoinsAcquisQuizComponent extends QuizSessionPageBase<
  BesoinsAcquisPromptState,
  BesoinsAcquisSubmitAnswerResult
> {
  protected override readonly expectedQuizId = 'besoins-acquis';
  private readonly besoinsAcquisSession = inject(BesoinsAcquisSession);

  question: BesoinsAcquisQuestion | null = null;
  responses: BesoinsAcquisReponse[] = [];
  selectedResponseId: number | null = null;

  protected override canSubmit(): boolean {
    return !!this.question && this.selectedResponseId !== null;
  }

  protected override async readPromptState(): Promise<BesoinsAcquisPromptState> {
    return this.besoinsAcquisSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: BesoinsAcquisPromptState): void {
    this.question = prompt.question;
    this.responses = prompt.reponses;
    this.selectedResponseId = this.getDefaultResponseId(prompt.reponses);
  }

  protected override getAnsweredCount(prompt: BesoinsAcquisPromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: BesoinsAcquisSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async submitCurrentAnswer(): Promise<BesoinsAcquisSubmitAnswerResult> {
    if (!this.question || this.selectedResponseId === null) {
      throw new Error('Question ou réponse introuvable.');
    }

    return this.besoinsAcquisSession.submitAnswer(this.sessionId, this.currentUserId, {
      questionId: this.question.id,
      reponseId: this.selectedResponseId,
      besoinId: this.question.besoin,
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

  private getDefaultResponseId(reponses: BesoinsAcquisReponse[]): number | null {
    const ouiResponse = reponses.find((reponse) => reponse.label.trim().toLowerCase() === 'oui');
    if (ouiResponse) {
      return ouiResponse.id;
    }

    return reponses[0]?.id ?? null;
  }
}
