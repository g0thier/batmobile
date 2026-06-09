import { AsyncPipe } from '@angular/common';
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
import { SuccessAchievementCard, SuccessPageState, SuccessProgressService } from '../../core/success/success-progress';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css'],
  standalone: true,
  imports: [AsyncPipe, IonCard, IonCardContent, IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
})
export class SuccessComponent {
  private readonly successProgressService = inject(SuccessProgressService);

  readonly state$ = this.successProgressService.state$;
  private readonly brokenCovers = new Set<string>();

  onCoverError(cardId: string): void {
    this.brokenCovers.add(cardId);
  }

  hasBrokenCover(cardId: string): boolean {
    return this.brokenCovers.has(cardId);
  }

  trackByOverviewCardId(_index: number, card: SuccessPageState['overviewCards'][number]): string {
    return card.id;
  }

  trackBySectionId(_index: number, section: SuccessPageState['sections'][number]): string {
    return section.id;
  }

  trackByAchievementId(_index: number, achievement: SuccessAchievementCard): string {
    return achievement.id;
  }
}
