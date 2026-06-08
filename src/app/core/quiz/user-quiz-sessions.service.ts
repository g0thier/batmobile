import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, onValue, ref } from 'firebase/database';
import { BehaviorSubject, Observable, combineLatest, of, shareReplay, switchMap } from 'rxjs';
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

interface NormalizedUserQuizSession extends UserQuizSessionViewModel {
  selectedGuestIds: string[];
}

interface UserResponseMeta {
  status: string;
  updatedAt: string;
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
): NormalizedUserQuizSession => {
  const selectedGuestIds = extractSelectedGuestIds(rawSession['selectedGuests']);

  return {
    sessionId: readString(rawSession['sessionId']) || readString(id),
    quizId: readString(rawSession['quizId']),
    responseDeadline: readString(rawSession['responseDeadline']),
    status: readString(rawSession['status']),
    createdAt: readString(rawSession['createdAt']),
    updatedAt: readString(rawSession['updatedAt']),
    selectedGuestIds,
  };
};

const extractSelectedGuestIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((guest) => {
      if (guest && typeof guest === 'object') {
        const guestRecord = guest as Record<string, unknown>;
        return readString(guestRecord['uid'] ?? guestRecord['id']);
      }
      return readString(guest);
    })
    .filter(Boolean);
};

const toPublicSessionModel = ({
  selectedGuestIds: _selectedGuestIds,
  ...session
}: NormalizedUserQuizSession): UserQuizSessionViewModel => session;

const readUserResponseMeta = (
  sessionDetails: Record<string, unknown>,
  userId: string,
): UserResponseMeta => {
  const responsesByUser = asRecord(sessionDetails['responsesByUser']);
  const currentUserResponses = asRecord(responsesByUser[userId]);

  return {
    status: readString(currentUserResponses['status']),
    updatedAt: readString(currentUserResponses['updatedAt']),
  };
};

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
  private readonly refreshTrigger$ = new BehaviorSubject<number>(0);

  private async resolveVisibleSessions(
    sessions: NormalizedUserQuizSession[],
    userId: string,
  ): Promise<UserQuizSessionViewModel[]> {
    const normalizedUserId = readString(userId);
    if (!normalizedUserId) {
      return [];
    }

    const visibleSessions = await Promise.all(
      sessions.map(async (session) => {
        try {
          const sessionRef = ref(this.database, `quizSessions/${session.sessionId}`);
          const snapshot = await get(sessionRef);
          const sessionDetails = snapshot.exists() ? asRecord(snapshot.val()) : {};
          const selectedGuestIdsFromDetails = extractSelectedGuestIds(sessionDetails['selectedGuests']);
          const selectedGuestIds =
            session.selectedGuestIds.length > 0 ? session.selectedGuestIds : selectedGuestIdsFromDetails;

          if (selectedGuestIds.length > 0 && !selectedGuestIds.includes(normalizedUserId)) {
            return null;
          }

          const userResponseMeta = readUserResponseMeta(sessionDetails, normalizedUserId);
          const publicSession = toPublicSessionModel(session);

          return {
            ...publicSession,
            status: userResponseMeta.status || publicSession.status,
            updatedAt: userResponseMeta.updatedAt || publicSession.updatedAt,
          };
        } catch (error: unknown) {
          console.error('Impossible de vérifier les invités de la session quiz :', error);
          if (session.selectedGuestIds.length > 0 && session.selectedGuestIds.includes(normalizedUserId)) {
            return toPublicSessionModel(session);
          }

          return null;
        }
      }),
    );

    return visibleSessions.filter((session): session is UserQuizSessionViewModel => session !== null);
  }

  readonly state$ = combineLatest([this.authService.authUser$, this.refreshTrigger$]).pipe(
    switchMap(([currentUser]) => {
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
        let latestSnapshotVersion = 0;

        const userSessionsRef = ref(this.database, `users/${currentUser.uid}/quizSessions`);
        const unsubscribe = onValue(
          userSessionsRef,
          (snapshot) => {
            const rawSessions = snapshot.exists() ? asRecord(snapshot.val()) : {};
            const normalizedSessions = Object.entries(rawSessions).map(([id, rawSession]) =>
              normalizeSession(id, asRecord(rawSession)),
            );
            const snapshotVersion = ++latestSnapshotVersion;

            void this.resolveVisibleSessions(normalizedSessions, currentUser.uid)
              .then((visibleSessions) => {
                if (snapshotVersion !== latestSnapshotVersion) {
                  return;
                }

                const snapshotNowMs = Date.now();
                const splitSessions = splitSessionsByDeadline(visibleSessions, snapshotNowMs);

                subscriber.next({
                  upcomingQuiz: splitSessions.upcomingQuiz,
                  pastQuiz: splitSessions.pastQuiz,
                  isLoading: false,
                  loadError: '',
                });
              })
              .catch((error: unknown) => {
                if (snapshotVersion !== latestSnapshotVersion) {
                  return;
                }

                console.error('Impossible de filtrer les sessions quiz utilisateur :', error);
                subscriber.next({
                  upcomingQuiz: [],
                  pastQuiz: [],
                  isLoading: false,
                  loadError: QUIZ_SESSIONS_LOAD_ERROR,
                });
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

  refresh(): void {
    this.refreshTrigger$.next(this.refreshTrigger$.value + 1);
  }
}
