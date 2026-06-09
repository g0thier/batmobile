import { QuizCatalogService } from '../quiz/quiz-catalog.service';
import {
  buildSuccessPageState,
  buildSuccessProgressCache,
  type SuccessLiveSessionSnapshot,
} from './success-progress';

const quizCatalog = new QuizCatalogService();

const toIso = (hoursFromBase: number): string =>
  new Date(Date.UTC(2025, 0, 1, hoursFromBase, 0, 0)).toISOString();

const createSnapshot = (
  quizId: string,
  overrides: Partial<SuccessLiveSessionSnapshot> = {},
): SuccessLiveSessionSnapshot => ({
  sessionId: `session-${quizId}-${overrides.sessionId ?? 'a'}`,
  quizId: quizId as never,
  quizTitle: quizCatalog.getQuizTitle(quizId),
  coverUrl: quizCatalog.getQuiz(quizId).coverUrl,
  status: 'completed',
  answeredCount: 10,
  totalCount: 10,
  updatedAt: toIso(10),
  lastAnsweredAt: toIso(10),
  metrics: {},
  answerTimestamps: [toIso(10)],
  ...overrides,
});

describe('success progress', () => {
  it('unlocks the hidden question milestones progressively', () => {
    const cache = buildSuccessProgressCache([], Array.from({ length: 500 }, (_, index) => toIso(index)));
    const snapshots = [createSnapshot('attentes')];

    const state = buildSuccessPageState(cache, snapshots, quizCatalog);
    const questionSection = state.sections.find((section) => section.id === 'questions');

    expect(questionSection?.cards.map((card) => card.isUnlocked)).toEqual([true, true, true, false]);
    expect(questionSection?.cards.map((card) => card.title)).toEqual([
      'Explorateur',
      'Aventurier',
      'Héros',
      'Légendaire',
    ]);
    expect(questionSection?.cards.map((card) => card.coverUrl)).toEqual([
      '/success/milestone/explorateur.webp',
      '/success/milestone/aventurier.webp',
      '/success/milestone/heros.webp',
      '/success/milestone/legendaire.webp',
    ]);
  });

  it('unlocks the catalog card only when every quiz is completed at least once', () => {
    const snapshots = quizCatalog.getKnownQuizIds().map((quizId, index) =>
      createSnapshot(quizId, {
        sessionId: `session-${quizId}-${index}`,
        updatedAt: toIso(index + 1),
        lastAnsweredAt: toIso(index + 1),
      }),
    );
    const cache = buildSuccessProgressCache(snapshots, [toIso(1)]);

    const state = buildSuccessPageState(cache, snapshots, quizCatalog);
    const catalogSection = state.sections.find((section) => section.id === 'catalog');

    expect(catalogSection?.cards.filter((card) => card.id !== 'all-quizzes').every((card) => card.isUnlocked)).toBeTrue();
    expect(catalogSection?.cards.find((card) => card.id === 'all-quizzes')?.isUnlocked).toBeTrue();
  });

  it('unlocks record cards when a later session beats a previous best', () => {
    const snapshots: SuccessLiveSessionSnapshot[] = [
      createSnapshot('attentes', {
        sessionId: 'attentes-1',
        updatedAt: toIso(1),
        metrics: { averageScore: 40, balanceScore: 50 },
      }),
      createSnapshot('attentes', {
        sessionId: 'attentes-2',
        updatedAt: toIso(2),
        metrics: { averageScore: 72, balanceScore: 81 },
      }),
      createSnapshot('autodetermination', {
        sessionId: 'autodetermination-1',
        updatedAt: toIso(3),
        metrics: { intrinsicRate: 35 },
      }),
      createSnapshot('autodetermination', {
        sessionId: 'autodetermination-2',
        updatedAt: toIso(4),
        metrics: { intrinsicRate: 80 },
      }),
      createSnapshot('besoins-acquis', {
        sessionId: 'besoins-acquis-1',
        updatedAt: toIso(5),
        metrics: { averageScore: 40 },
      }),
      createSnapshot('besoins-acquis', {
        sessionId: 'besoins-acquis-2',
        updatedAt: toIso(6),
        metrics: { averageScore: 78 },
      }),
      createSnapshot('equite', {
        sessionId: 'equite-1',
        updatedAt: toIso(7),
        metrics: { distanceFromZeroScore: 10 },
      }),
      createSnapshot('equite', {
        sessionId: 'equite-2',
        updatedAt: toIso(8),
        metrics: { distanceFromZeroScore: 80 },
      }),
      createSnapshot('identite-pro', {
        sessionId: 'identite-pro-1',
        updatedAt: toIso(9),
        metrics: {
          averageGapScore: 45,
          overallAverageScore: 42,
          alignedThemesScore: 1,
        },
      }),
      createSnapshot('identite-pro', {
        sessionId: 'identite-pro-2',
        updatedAt: toIso(10),
        metrics: {
          averageGapScore: 78,
          overallAverageScore: 58,
          alignedThemesScore: 4,
        },
      }),
      createSnapshot('pyramide-besoins', {
        sessionId: 'pyramide-besoins-1',
        updatedAt: toIso(11),
        metrics: { averageScore: 31 },
      }),
      createSnapshot('pyramide-besoins', {
        sessionId: 'pyramide-besoins-2',
        updatedAt: toIso(12),
        metrics: { averageScore: 67 },
      }),
      createSnapshot('theorie-x-y', {
        sessionId: 'theorie-x-y-1',
        updatedAt: toIso(13),
        metrics: { engagementRate: 28 },
      }),
      createSnapshot('theorie-x-y', {
        sessionId: 'theorie-x-y-2',
        updatedAt: toIso(14),
        metrics: { engagementRate: 92 },
      }),
    ];
    const cache = buildSuccessProgressCache(
      snapshots,
      [toIso(1), toIso(6), toIso(15), toIso(30), toIso(45), toIso(48)],
    );

    const state = buildSuccessPageState(cache, snapshots, quizCatalog);
    const recordsSection = state.sections.find((section) => section.id === 'records');

    expect(recordsSection?.cards.every((card) => card.isUnlocked)).toBeTrue();
    expect(recordsSection?.cards.map((card) => card.coverUrl)).toEqual(
      quizCatalog.getKnownQuizIds().map((quizId) => quizCatalog.getQuiz(quizId).coverUrl),
    );
  });

  it('unlocks assiduity milestones when responses become close enough', () => {
    const cache = buildSuccessProgressCache(
      [createSnapshot('attentes')],
      [toIso(0), toIso(15), toIso(30), toIso(45)],
    );
    const state = buildSuccessPageState(cache, [createSnapshot('attentes')], quizCatalog);
    const rhythmSection = state.sections.find((section) => section.id === 'rhythm');

    expect(rhythmSection?.cards.map((card) => card.isUnlocked)).toEqual([true, true, true, false, false]);
    expect(rhythmSection?.cards.map((card) => card.title)).toEqual([
      'Tortue',
      'Lièvre',
      'Gazelle',
      'Faucon',
      'Guépard',
    ]);
    expect(rhythmSection?.cards.map((card) => card.coverUrl)).toEqual([
      '/success/assiduite/tortue.webp',
      '/success/assiduite/lievre.webp',
      '/success/assiduite/gazelle.webp',
      '/success/assiduite/faucon.webp',
      '/success/assiduite/guepard.webp',
    ]);
  });

  it('keeps a stable live cache structure when the RTDB cache is absent', () => {
    const snapshots = [
      createSnapshot('attentes', {
        sessionId: 'attentes-live',
        updatedAt: toIso(1),
        lastAnsweredAt: toIso(1),
      }),
      createSnapshot('equite', {
        sessionId: 'equite-live',
        updatedAt: toIso(2),
        lastAnsweredAt: toIso(2),
      }),
    ];

    const cache = buildSuccessProgressCache(snapshots, [toIso(1), toIso(2), toIso(2)]);

    expect(cache.version).toBe(1);
    expect(cache.sessionsById['attentes-live']?.quizId).toBe('attentes');
    expect(cache.answerTimeline).toEqual([toIso(1), toIso(2)]);
  });
});
