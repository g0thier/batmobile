import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  UserQuizSessionViewModel,
  UserQuizSessionsService,
  UserQuizSessionsState,
} from '../../core/quiz/user-quiz-sessions.service';
import { QuizSessionContextService } from '../../core/quiz/quiz-session-context.service';
import { map } from 'rxjs';

type LauncherAction = 'history' | 'session';

interface QuizLauncherState {
  buttonLabel: string;
  action: LauncherAction;
  selectedSession: UserQuizSessionViewModel | null;
  isLoading: boolean;
  loadError: string;
}

const FINISHED_STATUSES = new Set(['completed', 'archived']);

const readString = (value: string): string => value.trim();

const normalizeStatus = (value: string): string => readString(value).toLowerCase();

const parseDate = (value: string): Date | null => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp);
};

const isSameLocalDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const toTimestamp = (value: string): number | null => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const sortByUpdatedAtAsc = (left: UserQuizSessionViewModel, right: UserQuizSessionViewModel): number => {
  const leftTimestamp = toTimestamp(left.updatedAt);
  const rightTimestamp = toTimestamp(right.updatedAt);

  if (leftTimestamp === null && rightTimestamp === null) {
    return left.sessionId.localeCompare(right.sessionId);
  }
  if (leftTimestamp === null) {
    return 1;
  }
  if (rightTimestamp === null) {
    return -1;
  }

  return leftTimestamp - rightTimestamp;
};

const sortByDeadlineAsc = (left: UserQuizSessionViewModel, right: UserQuizSessionViewModel): number => {
  const leftTimestamp = toTimestamp(left.responseDeadline);
  const rightTimestamp = toTimestamp(right.responseDeadline);

  if (leftTimestamp === null && rightTimestamp === null) {
    return left.sessionId.localeCompare(right.sessionId);
  }
  if (leftTimestamp === null) {
    return 1;
  }
  if (rightTimestamp === null) {
    return -1;
  }

  return leftTimestamp - rightTimestamp;
};

const isFinishedStatus = (status: string): boolean => FINISHED_STATUSES.has(normalizeStatus(status));

const hasAnsweredToday = (sessions: UserQuizSessionViewModel[]): boolean => {
  const today = new Date();

  return sessions.some((session) => {
    const updatedAt = readString(session.updatedAt);
    const createdAt = readString(session.createdAt);
    if (!updatedAt || updatedAt === createdAt) {
      return false;
    }

    const updatedDate = parseDate(updatedAt);
    if (!updatedDate) {
      return false;
    }

    return isSameLocalDay(updatedDate, today);
  });
};

const pickSession = (sessions: UserQuizSessionViewModel[]): UserQuizSessionViewModel | null => {
  const startedSessions = sessions
    .filter((session) => normalizeStatus(session.status) === 'started')
    .sort(sortByUpdatedAtAsc);

  if (startedSessions.length > 0) {
    return startedSessions[0] ?? null;
  }

  const remainingSessions = sessions
    .filter((session) => !isFinishedStatus(session.status))
    .sort(sortByDeadlineAsc);

  return remainingSessions[0] ?? null;
};

const toLauncherState = (state: UserQuizSessionsState): QuizLauncherState => {
  const sessions = [...state.upcomingQuiz, ...state.pastQuiz];
  const allDone = sessions.length > 0 && sessions.every((session) => isFinishedStatus(session.status));

  if (allDone) {
    return {
      buttonLabel: "Voir l'historique",
      action: 'history',
      selectedSession: null,
      isLoading: state.isLoading,
      loadError: state.loadError,
    };
  }

  const selectedSession = pickSession(sessions);

  return {
    buttonLabel: hasAnsweredToday(sessions) ? 'En faire plus' : 'Question du jour',
    action: selectedSession ? 'session' : 'history',
    selectedSession,
    isLoading: state.isLoading,
    loadError: state.loadError,
  };
};

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css'],
  standalone: true,
  imports: [
    AsyncPipe,
    IonButton,
    IonContent,
    IonHeader,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class QuizComponent {
  private readonly userQuizSessionsService = inject(UserQuizSessionsService);
  private readonly quizSessionContextService = inject(QuizSessionContextService);
  private readonly router = inject(Router);

  readonly launcherState$ = this.userQuizSessionsService.state$.pipe(map(toLauncherState));

  async onLauncherTap(state: QuizLauncherState): Promise<void> {
    if (state.action === 'session' && state.selectedSession) {
      this.quizSessionContextService.setCurrentSession(state.selectedSession);
      await this.router.navigateByUrl('/tabs/quiz-session');
      return;
    }

    await this.router.navigateByUrl('/tabs/history');
  }
}
