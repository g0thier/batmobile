import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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
import { QuizCatalogService } from '../../core/quiz/quiz-catalog.service';
import {
  UserQuizSessionsState,
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
  private readonly userQuizSessionsService = inject(UserQuizSessionsService);
  private readonly quizCatalogService = inject(QuizCatalogService);
  private readonly router = inject(Router);

  readonly state$ = this.userQuizSessionsService.state$;

  getQuizTitle(quizId: string): string {
    return this.quizCatalogService.getQuizTitle(quizId);
  }

  getQuizCover(quizId: string): string {
    return this.quizCatalogService.getQuiz(quizId).coverUrl;
  }

  getTodoQuiz(state: UserQuizSessionsState): UserQuizSessionViewModel[] {
    return state.upcomingQuiz.filter((quiz) => !this.isCompletedStatus(quiz.status));
  }

  getCompletedQuiz(state: UserQuizSessionsState): UserQuizSessionViewModel[] {
    const completedUpcoming = state.upcomingQuiz.filter((quiz) => this.isCompletedStatus(quiz.status));
    return [...completedUpcoming, ...state.pastQuiz];
  }

  isNeverLaunchedQuiz(quiz: UserQuizSessionViewModel): boolean {
    const normalizedStatus = this.normalizeStatus(quiz.status);
    return !normalizedStatus || normalizedStatus === 'invited';
  }

  formatDateTime(value: string): string {
    const parsedTimestamp = new Date(String(value || '')).getTime();
    if (!Number.isFinite(parsedTimestamp)) {
      return 'Date limite à confirmer';
    }

    return new Date(parsedTimestamp).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  getStatusLabel(rawStatus: string): string {
    const normalizedStatus = this.normalizeStatus(rawStatus);
    if (!normalizedStatus) {
      return 'Oublié';
    }

    const labels: Record<string, string> = {
      invited: 'Oublié',
      started: 'En cours',
      completed: 'Terminé',
      archived: 'Archivé',
    };

    return labels[normalizedStatus] ?? normalizedStatus;
  }

  getTodoBadgeLabel(quiz: UserQuizSessionViewModel): string {
    const normalizedStatus = this.normalizeStatus(quiz.status);
    return normalizedStatus === 'started' ? 'En cours' : 'À faire';
  }

  getTodoStatusLabel(quiz: UserQuizSessionViewModel): string {
    const normalizedStatus = this.normalizeStatus(quiz.status);

    if (normalizedStatus === 'started') {
      return 'En cours';
    }

    if (!normalizedStatus || normalizedStatus === 'invited') {
      return 'À faire';
    }

    return this.getStatusLabel(quiz.status);
  }

  trackBySessionId(_index: number, quiz: UserQuizSessionViewModel): string {
    return quiz.sessionId;
  }

  private isCompletedStatus(rawStatus: string): boolean {
    return this.normalizeStatus(rawStatus) === 'completed';
  }

  private normalizeStatus(rawStatus: string): string {
    return rawStatus.trim().toLowerCase();
  }

  async onUpcomingQuizCardTap(quiz: UserQuizSessionViewModel): Promise<void> {
    await this.router.navigateByUrl(`/tabs/quiz-session/${quiz.quizId.trim().toLowerCase()}/${quiz.sessionId}`);
  }

  async onPastQuizCardTap(quiz: UserQuizSessionViewModel): Promise<void> {
    await this.router.navigateByUrl(`/tabs/quiz-stats/${quiz.quizId.trim().toLowerCase()}/${quiz.sessionId}`);
  }

  async onUpcomingQuizCardKeyDown(event: KeyboardEvent, quiz: UserQuizSessionViewModel): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onUpcomingQuizCardTap(quiz);
  }

  async onPastQuizCardKeyDown(event: KeyboardEvent, quiz: UserQuizSessionViewModel): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    await this.onPastQuizCardTap(quiz);
  }
}
