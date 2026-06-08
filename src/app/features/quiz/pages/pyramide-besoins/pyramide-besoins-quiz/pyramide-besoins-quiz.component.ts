import { Component, inject } from '@angular/core';
import {
  IonButton,
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
  PyramideBesoinsAffirmation,
  PyramideBesoinsReponse,
  PyramideBesoinsSession,
  PyramideBesoinsPromptState,
  PyramideBesoinsSubmitAnswerResult,
} from '../../../../../core/quiz/pyramide-besoins-session';

@Component({
  selector: 'app-pyramide-besoins-quiz',
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './pyramide-besoins-quiz.component.html',
  styleUrl: './pyramide-besoins-quiz.component.css',
})
export class PyramideBesoinsQuizComponent extends QuizSessionPageBase<
  PyramideBesoinsPromptState,
  PyramideBesoinsSubmitAnswerResult
> {
  protected override readonly expectedQuizId = 'pyramide-besoins';
  private readonly pyramideBesoinsSession = inject(PyramideBesoinsSession);

  affirmation: PyramideBesoinsAffirmation | null = null;
  reponses: PyramideBesoinsReponse[] = [];
  selectedReponseId: number | null = null;

  protected override canSubmit(): boolean {
    return !!this.affirmation && this.selectedReponseId !== null;
  }

  protected override async readPromptState(): Promise<PyramideBesoinsPromptState> {
    return this.pyramideBesoinsSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: PyramideBesoinsPromptState): void {
    this.affirmation = prompt.affirmation;
    this.reponses = prompt.reponses;
    this.selectedReponseId = null;
  }

  protected override getAnsweredCount(prompt: PyramideBesoinsPromptState): number {
    return prompt.answeredCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: PyramideBesoinsSubmitAnswerResult): number {
    return result.answeredCount;
  }

  protected override async submitCurrentAnswer(): Promise<PyramideBesoinsSubmitAnswerResult> {
    if (!this.affirmation || this.selectedReponseId === null) {
      throw new Error('Affirmation ou réponse introuvable.');
    }

    return this.pyramideBesoinsSession.submitAnswer(this.sessionId, this.currentUserId, {
      affirmationId: this.affirmation.id,
      reponseId: this.selectedReponseId,
      besoinId: this.affirmation.besoin,
    });
  }

  async onChoiceTap(reponseId: number): Promise<void> {
    if (!this.affirmation) {
      return;
    }

    if (!this.reponses.some((reponse) => reponse.id === reponseId)) {
      return;
    }

    this.selectedReponseId = reponseId;
    await this.onValidateTap();
  }

  async onChoiceKeyDown(event: KeyboardEvent, reponseId: number): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onChoiceTap(reponseId);
  }
}
