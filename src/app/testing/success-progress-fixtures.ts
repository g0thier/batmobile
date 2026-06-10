import { Database } from '@angular/fire/database';
import { BehaviorSubject, of, type Observable } from 'rxjs';
import { AuthService } from '../core/auth/auth';
import { QuizCatalogService } from '../core/quiz/quiz-catalog.service';
import { UserQuizSessionsService, type UserQuizSessionsState } from '../core/quiz/user-quiz-sessions.service';
import type { SuccessLiveSessionSnapshot } from '../core/success/success-progress';
import type { User } from '@angular/fire/auth';

export const quizCatalogForSuccessProgressTests = new QuizCatalogService();

export const toIso = (hoursFromBase: number): string =>
  new Date(Date.UTC(2025, 0, 1, hoursFromBase, 0, 0)).toISOString();

export const createSuccessSnapshot = (
  quizId: string,
  overrides: Partial<SuccessLiveSessionSnapshot> = {},
): SuccessLiveSessionSnapshot => ({
  sessionId: `session-${quizId}-${overrides.sessionId ?? 'a'}`,
  quizId: quizId as never,
  quizTitle: quizCatalogForSuccessProgressTests.getQuizTitle(quizId),
  coverUrl: quizCatalogForSuccessProgressTests.getQuiz(quizId).coverUrl,
  status: 'completed',
  answeredCount: 10,
  totalCount: 10,
  updatedAt: toIso(10),
  lastAnsweredAt: toIso(10),
  metrics: {},
  answerTimestamps: [toIso(10)],
  ...overrides,
});

export const questionMilestoneTimeline = Array.from({ length: 500 }, (_, index) => toIso(index));

export const catalogSnapshots = quizCatalogForSuccessProgressTests.getKnownQuizIds().map((quizId, index) =>
  createSuccessSnapshot(quizId, {
    sessionId: `session-${quizId}-${index}`,
    updatedAt: toIso(index + 1),
    lastAnsweredAt: toIso(index + 1),
  }),
);

export const recordSnapshots: SuccessLiveSessionSnapshot[] = [
  createSuccessSnapshot('attentes', {
    sessionId: 'attentes-1',
    updatedAt: toIso(1),
    metrics: { averageScore: 40, balanceScore: 50 },
  }),
  createSuccessSnapshot('attentes', {
    sessionId: 'attentes-2',
    updatedAt: toIso(2),
    metrics: { averageScore: 72, balanceScore: 81 },
  }),
  createSuccessSnapshot('autodetermination', {
    sessionId: 'autodetermination-1',
    updatedAt: toIso(3),
    metrics: { intrinsicRate: 35 },
  }),
  createSuccessSnapshot('autodetermination', {
    sessionId: 'autodetermination-2',
    updatedAt: toIso(4),
    metrics: { intrinsicRate: 80 },
  }),
  createSuccessSnapshot('besoins-acquis', {
    sessionId: 'besoins-acquis-1',
    updatedAt: toIso(5),
    metrics: { averageScore: 40 },
  }),
  createSuccessSnapshot('besoins-acquis', {
    sessionId: 'besoins-acquis-2',
    updatedAt: toIso(6),
    metrics: { averageScore: 78 },
  }),
  createSuccessSnapshot('equite', {
    sessionId: 'equite-1',
    updatedAt: toIso(7),
    metrics: { distanceFromZeroScore: 10 },
  }),
  createSuccessSnapshot('equite', {
    sessionId: 'equite-2',
    updatedAt: toIso(8),
    metrics: { distanceFromZeroScore: 80 },
  }),
  createSuccessSnapshot('identite-pro', {
    sessionId: 'identite-pro-1',
    updatedAt: toIso(9),
    metrics: {
      averageGapScore: 45,
      overallAverageScore: 42,
      alignedThemesScore: 1,
    },
  }),
  createSuccessSnapshot('identite-pro', {
    sessionId: 'identite-pro-2',
    updatedAt: toIso(10),
    metrics: {
      averageGapScore: 78,
      overallAverageScore: 58,
      alignedThemesScore: 4,
    },
  }),
  createSuccessSnapshot('pyramide-besoins', {
    sessionId: 'pyramide-besoins-1',
    updatedAt: toIso(11),
    metrics: { averageScore: 31 },
  }),
  createSuccessSnapshot('pyramide-besoins', {
    sessionId: 'pyramide-besoins-2',
    updatedAt: toIso(12),
    metrics: { averageScore: 67 },
  }),
  createSuccessSnapshot('theorie-x-y', {
    sessionId: 'theorie-x-y-1',
    updatedAt: toIso(13),
    metrics: { engagementRate: 28 },
  }),
  createSuccessSnapshot('theorie-x-y', {
    sessionId: 'theorie-x-y-2',
    updatedAt: toIso(14),
    metrics: { engagementRate: 92 },
  }),
];

export const assiduityTimeline = [toIso(0), toIso(15), toIso(30), toIso(45)];
export const duplicateTimelineSnapshots = [
  createSuccessSnapshot('attentes', {
    sessionId: 'attentes-live',
    updatedAt: toIso(1),
    lastAnsweredAt: toIso(1),
  }),
  createSuccessSnapshot('equite', {
    sessionId: 'equite-live',
    updatedAt: toIso(2),
    lastAnsweredAt: toIso(2),
  }),
];

export const emptyUserQuizSessionsState: UserQuizSessionsState = {
  upcomingQuiz: [],
  pastQuiz: [],
  isLoading: false,
  loadError: '',
};

export const createSuccessProgressProviders = (
  authUser$: BehaviorSubject<User | null>,
  userQuizSessionsState: UserQuizSessionsState = emptyUserQuizSessionsState,
) => [
  { provide: Database, useValue: {} },
  {
    provide: AuthService,
    useValue: {
      authUser$: authUser$.asObservable(),
    },
  },
  {
    provide: UserQuizSessionsService,
    useValue: {
      state$: of(userQuizSessionsState),
    },
  },
];
