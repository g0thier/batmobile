import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AlertController,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { QuizCatalogService } from '../../core/quiz/quiz-catalog.service';
import {
  UserQuizSessionViewModel,
  UserQuizSessionsService,
} from '../../core/quiz/user-quiz-sessions.service';
import { MaterialIconComponent } from '../../shared/material-icon/material-icon.component';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css'],
  standalone: true,
  imports: [
    AsyncPipe,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    MaterialIconComponent,
  ],
})
export class HistoryComponent {
  private readonly alertController = inject(AlertController);
  private readonly userQuizSessionsService = inject(UserQuizSessionsService);
  private readonly quizCatalogService = inject(QuizCatalogService);

  readonly state$ = this.userQuizSessionsService.state$;

  getQuizTitle(quizId: string): string {
    return this.quizCatalogService.getQuizTitle(quizId);
  }

  getQuizCover(quizId: string): string {
    return this.quizCatalogService.getQuiz(quizId).coverUrl;
  }

  formatDateTime(value: string): string {
    const parsedTimestamp = new Date(String(value || '')).getTime();
    if (!Number.isFinite(parsedTimestamp)) {
      return 'Date limite à confirmer';
    }

    return new Date(parsedTimestamp).toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusLabel(rawStatus: string): string {
    const normalizedStatus = rawStatus.trim().toLowerCase();
    if (!normalizedStatus) {
      return 'Invité';
    }

    const labels: Record<string, string> = {
      invited: 'Invité',
      started: 'En cours',
      completed: 'Terminé',
      archived: 'Archivé',
    };

    return labels[normalizedStatus] ?? normalizedStatus;
  }

  trackBySessionId(_index: number, quiz: UserQuizSessionViewModel): string {
    return quiz.sessionId;
  }

  async onQuizCardTap(quiz: UserQuizSessionViewModel): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Informations du quiz',
      message: [
        `Quiz: ${this.getQuizTitle(quiz.quizId)}`,
        `Session ID: ${quiz.sessionId || 'N/A'}`,
        `Deadline: ${quiz.responseDeadline || 'Non renseignée'}`,
        `Statut: ${quiz.status || 'invited'}`,
      ].join('<br />'),
      buttons: ['Fermer'],
    });

    await alert.present();
  }

  async onQuizCardKeyDown(event: KeyboardEvent, quiz: UserQuizSessionViewModel): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onQuizCardTap(quiz);
  }
}
