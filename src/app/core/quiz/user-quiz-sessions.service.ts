import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { onValue, ref } from 'firebase/database';
import { Observable, of, shareReplay, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth';

export interface UserQuizSessionViewModel {
  sessionId: string;
  quizId: string;
  responseDeadline: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserQuizSessionsState {
  upcomingQuiz: UserQuizSessionViewModel[];
  pastQuiz: UserQuizSessionViewModel[];
  isLoading: boolean;
  loadError: string;
}

const QUIZ_SESSIONS_LOAD_ERROR = 'Impossible de charger les quiz pour le moment.';

const EMPTY_STATE: UserQuizSessionsState = {
  upcomingQuiz: [],
  pastQuiz: [],
  isLoading: true,
  loadError: '',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string => String(value ?? '').trim();

const toTimestamp = (value: string): number | null => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const sortUpcoming = (a: UserQuizSessionViewModel, b: UserQuizSessionViewModel): number => {
  const aTimestamp = toTimestamp(a.responseDeadline);
  const bTimestamp = toTimestamp(b.responseDeadline);

  if (aTimestamp === null && bTimestamp === null) {
    return 0;
  }
  if (aTimestamp === null) {
    return 1;
  }
  if (bTimestamp === null) {
    return -1;
  }

  return aTimestamp - bTimestamp;
};

const sortPast = (a: UserQuizSessionViewModel, b: UserQuizSessionViewModel): number => {
  const aTimestamp = toTimestamp(a.responseDeadline);
  const bTimestamp = toTimestamp(b.responseDeadline);

  if (aTimestamp === null && bTimestamp === null) {
    return 0;
  }
  if (aTimestamp === null) {
    return 1;
  }
  if (bTimestamp === null) {
    return -1;
  }

  return bTimestamp - aTimestamp;
};

const normalizeSession = (
  id: string,
  rawSession: Record<string, unknown>,
): UserQuizSessionViewModel => ({
  sessionId: readString(rawSession['sessionId']) || readString(id),
  quizId: readString(rawSession['quizId']),
  responseDeadline: readString(rawSession['responseDeadline']),
  status: readString(rawSession['status']),
  createdAt: readString(rawSession['createdAt']),
  updatedAt: readString(rawSession['updatedAt']),
});

const splitSessionsByDeadline = (
  sessions: UserQuizSessionViewModel[],
  snapshotNowMs: number,
): Pick<UserQuizSessionsState, 'upcomingQuiz' | 'pastQuiz'> => {
  const upcomingQuiz: UserQuizSessionViewModel[] = [];
  const pastQuiz: UserQuizSessionViewModel[] = [];

  sessions.forEach((session) => {
    const deadlineTimestamp = toTimestamp(session.responseDeadline);
    if (deadlineTimestamp !== null && deadlineTimestamp < snapshotNowMs) {
      pastQuiz.push(session);
      return;
    }

    upcomingQuiz.push(session);
  });

  upcomingQuiz.sort(sortUpcoming);
  pastQuiz.sort(sortPast);

  return { upcomingQuiz, pastQuiz };
};

@Injectable({
  providedIn: 'root',
})
export class UserQuizSessionsService {
  private readonly authService = inject(AuthService);
  private readonly database = inject(Database);

  readonly state$ = this.authService.authUser$.pipe(
    switchMap((currentUser) => {
      if (!currentUser) {
        return of({
          upcomingQuiz: [],
          pastQuiz: [],
          isLoading: false,
          loadError: '',
        } satisfies UserQuizSessionsState);
      }

      return new Observable<UserQuizSessionsState>((subscriber) => {
        subscriber.next({ ...EMPTY_STATE, upcomingQuiz: [], pastQuiz: [] });

        const userSessionsRef = ref(this.database, `users/${currentUser.uid}/quizSessions`);
        const unsubscribe = onValue(
          userSessionsRef,
          (snapshot) => {
            const rawSessions = snapshot.exists() ? asRecord(snapshot.val()) : {};
            const normalizedSessions = Object.entries(rawSessions).map(([id, rawSession]) =>
              normalizeSession(id, asRecord(rawSession)),
            );
            const snapshotNowMs = Date.now();
            const splitSessions = splitSessionsByDeadline(normalizedSessions, snapshotNowMs);

            subscriber.next({
              upcomingQuiz: splitSessions.upcomingQuiz,
              pastQuiz: splitSessions.pastQuiz,
              isLoading: false,
              loadError: '',
            });
          },
          (loadError: unknown) => {
            console.error('Impossible de charger les sessions quiz utilisateur :', loadError);
            subscriber.next({
              upcomingQuiz: [],
              pastQuiz: [],
              isLoading: false,
              loadError: QUIZ_SESSIONS_LOAD_ERROR,
            });
          },
        );

        return () => {
          unsubscribe();
        };
      });
    }),
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );
}
