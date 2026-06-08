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
  MimetismeChoiceInput,
  MimetismeModele,
  MimetismePromptPair,
  MimetismeSession,
  MimetismePromptState,
  MimetismeSubmitChoiceResult,
} from '../../../../../core/quiz/mimetisme-session';

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
export class MimetismeQuizComponent extends QuizSessionPageBase<
  MimetismePromptState,
  MimetismeSubmitChoiceResult
> {
  protected override readonly expectedQuizId = 'mimetisme';
  private readonly mimetismeSession = inject(MimetismeSession);
  private readonly brokenPortraitIds = new Set<number>();
  private pendingChoice: MimetismeChoiceInput | null = null;

  pair: MimetismePromptPair | null = null;
  rankedCount = 0;
  comparisonsCount = 0;

  protected override canSubmit(): boolean {
    return !!this.pair && !!this.pendingChoice;
  }

  protected override async readPromptState(): Promise<MimetismePromptState> {
    return this.mimetismeSession.getPromptForSession(this.sessionId, this.currentUserId);
  }

  protected override applyPromptState(prompt: MimetismePromptState): void {
    this.pair = prompt.pair;
    this.rankedCount = prompt.rankedCount;
    this.comparisonsCount = prompt.comparisonsCount;
    this.pendingChoice = null;
  }

  protected override getAnsweredCount(prompt: MimetismePromptState): number {
    return prompt.rankedCount;
  }

  protected override getAnsweredCountFromSubmitResult(result: MimetismeSubmitChoiceResult): number {
    return result.rankedCount;
  }

  protected override async submitCurrentAnswer(): Promise<MimetismeSubmitChoiceResult> {
    if (!this.pendingChoice) {
      throw new Error('Comparaison introuvable.');
    }

    return this.mimetismeSession.submitChoice(this.sessionId, this.currentUserId, this.pendingChoice);
  }

  async onChoiceTap(preferred: MimetismeModele, other: MimetismeModele): Promise<void> {
    if (!this.pair) {
      return;
    }

    this.pendingChoice = {
      preferredModelId: preferred.id,
      otherModelId: other.id,
    };
    await this.onValidateTap();
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

}
