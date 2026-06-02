import { inject, Injectable, Injector } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, onValue, ref, set, update } from 'firebase/database';
import { combineLatest, firstValueFrom, from, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth';
import { QuizCatalogService, type QuizId } from '../quiz/quiz-catalog.service';
import {
  UserQuizSessionsService,
  type UserQuizSessionViewModel,
  type UserQuizSessionsState,
} from '../quiz/user-quiz-sessions.service';
import type { AttentesSessionStats } from '../quiz/attentes-session';
import type { AutodeterminationSessionStats } from '../quiz/autodetermination-session';
import type { BesoinsAcquisSessionStats } from '../quiz/besoins-acquis-session';
import type { EquiteSessionStats } from '../quiz/equite-session';
import type { IdentiteProSessionStats } from '../quiz/identite-pro-session';
import type { MimetismeSessionStats } from '../quiz/mimetisme-session';
import type { PyramideBesoinsSessionStats } from '../quiz/pyramide-besoins-session';
import type { TheorieXYSessionStats } from '../quiz/theorie-x-y-session';

export type SuccessMetricDirection = 'higher' | 'lower';

export interface SuccessSessionSummary {
  sessionId: string;
  quizId: QuizId;
  quizTitle: string;
  coverUrl: string;
  status: string;
  answeredCount: number;
  totalCount: number;
  updatedAt: string;
  lastAnsweredAt: string;
  metrics: Record<string, number>;
}

export interface SuccessProgressCache {
  version: 1;
  updatedAt: string;
  answerTimeline: string[];
  sessionsById: Record<string, SuccessSessionSummary>;
}

export interface SuccessAchievementCard {
  id: string;
  title: string;
  subtitle: string;
  progressLabel: string;
  progressPercent: number;
  isUnlocked: boolean;
  coverUrl: string;
  fallbackIcon: string;
}

export interface SuccessSection {
  id: string;
  title: string;
  subtitle: string;
  unlockedCount: number;
  totalCount: number;
  cards: SuccessAchievementCard[];
}

export interface SuccessOverviewCard {
  id: string;
  label: string;
  value: string;
  note: string;
}

export interface SuccessPageState {
  isLoading: boolean;
  loadError: string;
  overviewCards: SuccessOverviewCard[];
  sections: SuccessSection[];
}

interface SuccessMetricRule {
  key: string;
  direction: SuccessMetricDirection;
}

interface SuccessSessionNode {
  status: string;
  updatedAt: string;
  responses: Array<{ answeredAt: string }>;
}

export interface SuccessLiveSessionSnapshot extends SuccessSessionSummary {
  answerTimestamps: string[];
}

export interface SuccessSessionSource {
  sessionId: string;
  quizId: QuizId | string;
}

const QUESTIONS_MILESTONES = [20, 100, 500, 1000];
const ASSIDUITY_THRESHOLDS_HOURS = [72, 48, 24, 12, 6];
const IMPROVEMENT_QUIZ_IDS: QuizId[] = [
  'attentes',
  'autodetermination',
  'besoins-acquis',
  'equite',
  'identite-pro',
  'pyramide-besoins',
  'theorie-x-y',
];

const SUCCESS_CACHE_VERSION = 1 as const;
const SUCCESS_CACHE_PATH = (userId: string): string => `users/${userId}/successProgress`;

const EMPTY_PAGE_STATE: SuccessPageState = {
  isLoading: true,
  loadError: '',
  overviewCards: [],
  sections: [],
};

const IMPROVEMENT_RULES: Record<QuizId, SuccessMetricRule[]> = {
  attentes: [
    { key: 'averageScore', direction: 'higher' },
    { key: 'balanceScore', direction: 'higher' },
  ],
  autodetermination: [{ key: 'intrinsicRate', direction: 'higher' }],
  'besoins-acquis': [{ key: 'averageScore', direction: 'higher' }],
  equite: [{ key: 'distanceFromZeroScore', direction: 'higher' }],
  'identite-pro': [
    { key: 'averageGapScore', direction: 'higher' },
    { key: 'overallAverageScore', direction: 'higher' },
    { key: 'alignedThemesScore', direction: 'higher' },
  ],
  'pyramide-besoins': [{ key: 'averageScore', direction: 'higher' }],
  'theorie-x-y': [{ key: 'engagementRate', direction: 'higher' }],
  mimetisme: [],
};

const QUIZ_SUCCESS_IMAGE_PATH = (quizId: string): string => `/quiz/success/1x1/${quizId}.png`;

const readString = (value: unknown): string => String(value ?? '').trim();

const parseTimestamp = (value: string): number | null => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const normalizeTimestampList = (timestamps: string[]): string[] => {
  const normalized = timestamps
    .map((timestamp) => readString(timestamp))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTimestamp = parseTimestamp(left);
      const rightTimestamp = parseTimestamp(right);

      if (leftTimestamp === null && rightTimestamp === null) {
        return left.localeCompare(right);
      }
      if (leftTimestamp === null) {
        return 1;
      }
      if (rightTimestamp === null) {
        return -1;
      }

      return leftTimestamp - rightTimestamp;
    });

  return normalized.filter((timestamp, index, source) => source.indexOf(timestamp) === index);
};

const getAverage = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getMax = (values: number[]): number => (values.length > 0 ? Math.max(...values) : 0);
const getMin = (values: number[]): number => (values.length > 0 ? Math.min(...values) : 0);

const formatCompactValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Math.round(value);
  return new Intl.NumberFormat('fr-FR').format(rounded);
};

const clampValue = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const isMetricImprovement = (
  currentValue: number,
  bestValue: number | null,
  direction: SuccessMetricDirection,
): boolean => {
  if (bestValue === null) {
    return false;
  }

  return direction === 'higher' ? currentValue > bestValue : currentValue < bestValue;
};


const buildQuizCards = (
  snapshots: SuccessLiveSessionSnapshot[],
  quizCatalog: QuizCatalogService,
): SuccessAchievementCard[] => {
  const completedQuizIds = new Set(
    snapshots.filter((snapshot) => snapshot.status.toLowerCase() === 'completed').map((snapshot) => snapshot.quizId),
  );

  return quizCatalog
    .getKnownQuizIds()
    .map((quizId) => {
      const quiz = quizCatalog.getQuiz(quizId);
      const unlocked = completedQuizIds.has(quizId);

      return {
        id: `quiz-${quizId}`,
        title: quiz.title,
        subtitle: unlocked ? 'Débloqué au moins une fois' : 'Encore à découvrir',
        progressLabel: unlocked ? 'Validé' : 'À débloquer',
        progressPercent: unlocked ? 100 : 0,
        isUnlocked: unlocked,
        coverUrl: quiz.coverUrl,
        fallbackIcon: 'quiz',
      } satisfies SuccessAchievementCard;
    });
};

const buildAllQuizUnlockedCard = (quizCards: SuccessAchievementCard[]): SuccessAchievementCard => {
  const unlockedCount = quizCards.filter((card) => card.isUnlocked).length;
  const allUnlocked = unlockedCount === quizCards.length && quizCards.length > 0;

  return {
    id: 'all-quizzes',
    title: 'Catalogue complet',
    subtitle: allUnlocked ? 'Tous les parcours ont déjà été ouverts' : 'Le catalogue n’est pas encore complet',
    progressLabel: `${unlockedCount}/${quizCards.length}`,
    progressPercent: quizCards.length > 0 ? Math.round((unlockedCount / quizCards.length) * 100) : 0,
    isUnlocked: allUnlocked,
    coverUrl: '/quiz/covers/quiz-cards.png',
    fallbackIcon: 'emoji_events',
  };
};

const buildQuestionMilestoneCards = (answeredCount: number): SuccessAchievementCard[] =>
  QUESTIONS_MILESTONES.map((threshold, index) => {
    const unlocked = answeredCount >= threshold;
    const progressPercent = clampValue((answeredCount / threshold) * 100, 0, 100);
    const titles = ['Élan', 'Cadence', 'Masse critique', 'Maîtrise'];

    return {
      id: `questions-${threshold}`,
      title: titles[index] ?? 'Progression',
      subtitle: 'Réponses accumulées',
      progressLabel: `${formatCompactValue(Math.min(answeredCount, threshold))}`,
      progressPercent,
      isUnlocked: unlocked,
      coverUrl: QUIZ_SUCCESS_IMAGE_PATH('questions'),
      fallbackIcon: 'trending_up',
    };
  });

const buildAssiduityCards = (answerTimeline: string[]): SuccessAchievementCard[] => {
  const timestamps = normalizeTimestampList(answerTimeline);
  const gapsHours: number[] = [];

  for (let index = 1; index < timestamps.length; index += 1) {
    const previousTimestamp = parseTimestamp(timestamps[index - 1] ?? '');
    const currentTimestamp = parseTimestamp(timestamps[index] ?? '');

    if (previousTimestamp === null || currentTimestamp === null) {
      continue;
    }

    gapsHours.push(Math.abs(currentTimestamp - previousTimestamp) / 3_600_000);
  }

  const bestGapHours = gapsHours.length > 0 ? Math.min(...gapsHours) : Number.POSITIVE_INFINITY;
  const titles = ['Rappel', 'Cadence', 'Présence', 'Rythme', 'Instinct'];

  return ASSIDUITY_THRESHOLDS_HOURS.map((threshold, index) => {
    const unlocked = bestGapHours <= threshold;
    const progressPercent =
      bestGapHours === Number.POSITIVE_INFINITY
        ? 0
        : clampValue(((threshold - bestGapHours) / threshold) * 100, 0, 100);

    return {
      id: `assiduite-${threshold}`,
      title: titles[index] ?? 'Rythme',
      subtitle: 'Réponse rapprochée',
      progressLabel: unlocked ? 'Validé' : 'En cours',
      progressPercent,
      isUnlocked: unlocked,
      coverUrl: QUIZ_SUCCESS_IMAGE_PATH('assiduite'),
      fallbackIcon: 'schedule',
    };
  });
};

const buildImprovementCards = (
  snapshots: SuccessLiveSessionSnapshot[],
  quizCatalog: QuizCatalogService,
): SuccessAchievementCard[] => {
  return IMPROVEMENT_QUIZ_IDS.map((quizId) => {
    const quizSnapshots = snapshots
      .filter((snapshot) => snapshot.quizId === quizId)
      .sort((left, right) => {
        const leftTimestamp = parseTimestamp(left.updatedAt);
        const rightTimestamp = parseTimestamp(right.updatedAt);

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
      });

    const rules = IMPROVEMENT_RULES[quizId];
    const unlocked = quizSnapshots.length > 1 && rules.length > 0
      ? quizSnapshots.some((snapshot, index) => {
          if (index === 0) {
            return false;
          }

          const previousBestByRule = new Map<string, number | null>();
          for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
            const previousSnapshot = quizSnapshots[previousIndex];
            rules.forEach((rule) => {
              const candidateValue = previousSnapshot.metrics[rule.key];
              const currentBest = previousBestByRule.get(rule.key);
              if (currentBest === undefined || currentBest === null) {
                previousBestByRule.set(rule.key, candidateValue);
                return;
              }

              if (rule.direction === 'higher') {
                previousBestByRule.set(rule.key, Math.max(currentBest, candidateValue));
                return;
              }

              previousBestByRule.set(rule.key, Math.min(currentBest, candidateValue));
            });
          }

          return rules.some((rule) => {
            const currentValue = snapshot.metrics[rule.key];
            const previousBest = previousBestByRule.get(rule.key) ?? null;
            return isMetricImprovement(currentValue, previousBest, rule.direction);
          });
        })
      : false;

    const quiz = quizCatalog.getQuiz(quizId);

    return {
      id: `improvement-${quizId}`,
      title: quiz.title,
      subtitle:
        quizId === 'identite-pro'
          ? 'Alignement et progression'
          : quizId === 'attentes'
            ? 'Équilibre et moyenne'
            : 'Record personnel',
      progressLabel: unlocked ? 'Nouveau sommet' : 'À construire',
      progressPercent: unlocked ? 100 : 0,
      isUnlocked: unlocked,
      coverUrl: QUIZ_SUCCESS_IMAGE_PATH(quizId),
      fallbackIcon: 'emoji_events',
    } satisfies SuccessAchievementCard;
  });
};

const buildImprovementOverview = (cards: SuccessAchievementCard[]): SuccessOverviewCard => {
  const unlockedCount = cards.filter((card) => card.isUnlocked).length;
  return {
    id: 'improvements',
    label: 'Records cachés',
    value: `${unlockedCount}/${cards.length}`,
    note: 'Progression personnelle',
  };
};

const buildRhythmOverview = (cards: SuccessAchievementCard[]): SuccessOverviewCard => {
  const unlockedCount = cards.filter((card) => card.isUnlocked).length;
  return {
    id: 'rhythm',
    label: 'Rythme',
    value: `${unlockedCount}/${cards.length}`,
    note: 'Réponses rapprochées',
  };
};

const buildCatalogOverview = (cards: SuccessAchievementCard[]): SuccessOverviewCard => {
  const unlockedCount = cards.filter((card) => card.isUnlocked).length;
  return {
    id: 'catalog',
    label: 'Quiz ouverts',
    value: `${unlockedCount}/${cards.length}`,
    note: 'Parcours découverts',
  };
};

const buildQuestionOverview = (answeredCount: number): SuccessOverviewCard => ({
  id: 'questions',
  label: 'Questions répondues',
  value: formatCompactValue(answeredCount),
  note: 'Total cumulé',
});

const buildSections = (
  snapshots: SuccessLiveSessionSnapshot[],
  cache: SuccessProgressCache,
  quizCatalog: QuizCatalogService,
): SuccessSection[] => {
  const questionCards = buildQuestionMilestoneCards(totalAnsweredCount(cache));
  const quizCards = buildQuizCards(snapshots, quizCatalog);
  const completionCard = buildAllQuizUnlockedCard(quizCards);
  const improvementCards = buildImprovementCards(snapshots, quizCatalog);
  const assiduityCards = buildAssiduityCards(cache.answerTimeline);

  return [
    {
      id: 'questions',
      title: 'Repères cachés',
      subtitle: 'Des paliers qui s’ouvrent sans montrer le seuil exact.',
      unlockedCount: questionCards.filter((card) => card.isUnlocked).length,
      totalCount: questionCards.length,
      cards: questionCards,
    },
    {
      id: 'catalog',
      title: 'Catalogue',
      subtitle: 'Chaque quiz passe en couleur dès sa première complétion.',
      unlockedCount: [...quizCards, completionCard].filter((card) => card.isUnlocked).length,
      totalCount: quizCards.length + 1,
      cards: [...quizCards, completionCard],
    },
    {
      id: 'records',
      title: 'Records personnels',
      subtitle: 'Les meilleures courbes, sans afficher la mécanique interne.',
      unlockedCount: improvementCards.filter((card) => card.isUnlocked).length,
      totalCount: improvementCards.length,
      cards: improvementCards,
    },
    {
      id: 'rhythm',
      title: 'Assiduité',
      subtitle: 'Un rythme de réponse qui se resserre par paliers.',
      unlockedCount: assiduityCards.filter((card) => card.isUnlocked).length,
      totalCount: assiduityCards.length,
      cards: assiduityCards,
    },
  ];
};

const totalAnsweredCount = (cache: SuccessProgressCache): number => normalizeTimestampList(cache.answerTimeline).length;

export function buildSuccessPageState(
  cache: SuccessProgressCache,
  snapshots: SuccessLiveSessionSnapshot[],
  quizCatalog: QuizCatalogService,
): SuccessPageState {
  const sections = buildSections(snapshots, cache, quizCatalog);
  const answeredCount = totalAnsweredCount(cache);
  const completedQuizCards = sections.find((section) => section.id === 'catalog')?.cards ?? [];
  const improvementCards = sections.find((section) => section.id === 'records')?.cards ?? [];
  const rhythmCards = sections.find((section) => section.id === 'rhythm')?.cards ?? [];
  return {
    isLoading: false,
    loadError: '',
    overviewCards: [
      buildQuestionOverview(answeredCount),
      buildCatalogOverview(completedQuizCards.filter((card) => card.id !== 'all-quizzes')),
      buildImprovementOverview(improvementCards),
      buildRhythmOverview(rhythmCards),
    ],
    sections: sections.map((section) => ({
      ...section,
      unlockedCount: section.cards.filter((card) => card.isUnlocked).length,
    })),
  };
}

export function buildSuccessProgressCache(
  snapshots: SuccessLiveSessionSnapshot[],
  answerTimeline: string[],
): SuccessProgressCache {
  const normalizedTimeline = normalizeTimestampList(answerTimeline);
  return {
    version: SUCCESS_CACHE_VERSION,
    updatedAt: normalizedTimeline[normalizedTimeline.length - 1] ?? '',
    answerTimeline: normalizedTimeline,
    sessionsById: Object.fromEntries(snapshots.map((snapshot) => [snapshot.sessionId, snapshot])),
  };
}

export function buildSessionSummaryFromAutodetermination(
  session: SuccessSessionSource,
  stats: AutodeterminationSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  const intrinsicRates = stats.dimensions.map((dimension) => dimension.intrinsequePct);
  const responseBalance = stats.dimensions.map((dimension) =>
    Math.abs(dimension.intrinsequePct - dimension.extrinsequePct),
  );

  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      intrinsicRate: Number(getAverage(intrinsicRates).toFixed(2)),
      balanceScore: Number((100 - getAverage(responseBalance)).toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromAttentes(
  session: SuccessSessionSource,
  stats: AttentesSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  const factorNames = ['expectancy', 'instrumentality', 'valence'];
  const factorAverageByName = new Map<string, number>();

  factorNames.forEach((factorName, index) => {
    const collectedScores = stats.attentes.map((attente) => attente.scores[index] ?? 0);
    factorAverageByName.set(factorName, getAverage(collectedScores));
  });

  const scoreValues = stats.attentes.flatMap((attente) => attente.scores);
  const factorAverages = Array.from(factorAverageByName.values());

  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      averageScore: Number(getAverage(scoreValues).toFixed(2)),
      balanceScore: Number((100 - getMax(factorAverages) + getMin(factorAverages)).toFixed(2)),
      expectationAverage: Number((factorAverageByName.get('expectancy') ?? 0).toFixed(2)),
      instrumentalityAverage: Number((factorAverageByName.get('instrumentality') ?? 0).toFixed(2)),
      valueAverage: Number((factorAverageByName.get('valence') ?? 0).toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromBesoinsAcquis(
  session: SuccessSessionSource,
  stats: BesoinsAcquisSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      averageScore: Number(getAverage(stats.scores).toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromEquite(
  session: SuccessSessionSource,
  stats: EquiteSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  const averageAbsDistance = getAverage(stats.themes.map((theme) => Math.abs(theme.averageValue)));

  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      distanceFromZeroScore: Number((100 - averageAbsDistance * 10).toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromIdentitePro(
  session: SuccessSessionSource,
  stats: IdentiteProSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  const themeGapScores = stats.themes.map((theme) =>
    Math.abs(theme.identiteDeSoi.averageValue - theme.identitePercue.averageValue),
  );
  const themeAverageScores = stats.themes.map((theme) =>
    getAverage([theme.identiteDeSoi.averageValue, theme.identitePercue.averageValue]),
  );
  const alignedThemesCount = stats.themes.filter((theme) => {
    const gap = Math.abs(theme.identiteDeSoi.averageValue - theme.identitePercue.averageValue);
    return gap <= 1.5;
  }).length;

  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      averageGapScore: Number((100 - getAverage(themeGapScores) * 10).toFixed(2)),
      overallAverageScore: Number(getAverage(themeAverageScores).toFixed(2)),
      alignedThemesScore: Number(alignedThemesCount.toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromPyramideBesoins(
  session: SuccessSessionSource,
  stats: PyramideBesoinsSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      averageScore: Number(getAverage(stats.scores).toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromTheorieXY(
  session: SuccessSessionSource,
  stats: TheorieXYSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.answeredCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      engagementRate: Number(getAverage(stats.dimensions.map((dimension) => dimension.engagementPct)).toFixed(2)),
    },
  });
}

export function buildSessionSummaryFromMimetisme(
  session: SuccessSessionSource,
  stats: MimetismeSessionStats,
  answerTimestamp: string,
  quizCatalog: QuizCatalogService,
): SuccessSessionSummary {
  return buildSuccessSessionSummary({
    session,
    answeredCount: stats.rankedCount,
    totalCount: stats.totalCount,
    updatedAt: stats.updatedAt || answerTimestamp,
    answerTimestamp,
    quizCatalog,
    metrics: {
      averageScore: Number(getAverage(stats.scores).toFixed(2)),
    },
  });
}

function buildSuccessSessionSummary(input: {
  session: SuccessSessionSource;
  answeredCount: number;
  totalCount: number;
  updatedAt: string;
  answerTimestamp: string;
  quizCatalog: QuizCatalogService;
  metrics: Record<string, number>;
}): SuccessSessionSummary {
  const quiz = input.quizCatalog.getQuiz(input.session.quizId);
  const quizId = quiz.id || input.session.quizId.trim().toLowerCase();

  return {
    sessionId: input.session.sessionId,
    quizId: quizId as QuizId,
    quizTitle: quiz.title,
    coverUrl: quiz.coverUrl,
    status: input.answeredCount >= input.totalCount ? 'completed' : 'started',
    answeredCount: input.answeredCount,
    totalCount: input.totalCount,
    updatedAt: input.updatedAt || input.answerTimestamp,
    lastAnsweredAt: input.answerTimestamp,
    metrics: { ...input.metrics },
  };
}

const normalizeSessionSummary = (payload: unknown): SuccessSessionSummary | null => {
  const record = asRecord(payload);
  const sessionId = readString(record['sessionId']);
  const quizId = readString(record['quizId']).toLowerCase() as QuizId;
  if (!sessionId || !quizId) {
    return null;
  }

  const metrics = asRecord(record['metrics']);
  const metricValues: Record<string, number> = {};
  Object.entries(metrics).forEach(([key, value]) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      metricValues[key] = numericValue;
    }
  });

  return {
    sessionId,
    quizId,
    quizTitle: readString(record['quizTitle']),
    coverUrl: readString(record['coverUrl']),
    status: readString(record['status']),
    answeredCount: Number(record['answeredCount'] ?? 0) || 0,
    totalCount: Number(record['totalCount'] ?? 0) || 0,
    updatedAt: readString(record['updatedAt']),
    lastAnsweredAt: readString(record['lastAnsweredAt']),
    metrics: metricValues,
  };
};

const normalizeSuccessCache = (payload: unknown): SuccessProgressCache | null => {
  const record = asRecord(payload);
  if (Number(record['version'] ?? 0) !== SUCCESS_CACHE_VERSION) {
    return null;
  }

  const sessionsByIdRecord = asRecord(record['sessionsById']);
  const sessionsById: Record<string, SuccessSessionSummary> = {};

  Object.entries(sessionsByIdRecord).forEach(([sessionId, rawSummary]) => {
    const summary = normalizeSessionSummary(rawSummary);
    if (summary) {
      sessionsById[sessionId] = summary;
    }
  });

  return {
    version: SUCCESS_CACHE_VERSION,
    updatedAt: readString(record['updatedAt']),
    answerTimeline: normalizeTimestampList(
      Array.isArray(record['answerTimeline'])
        ? record['answerTimeline'].map((value) => readString(value))
        : [],
    ),
    sessionsById,
  };
};

const buildEmptyCache = (): SuccessProgressCache => ({
  version: SUCCESS_CACHE_VERSION,
  updatedAt: '',
  answerTimeline: [],
  sessionsById: {},
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readUserResponses = async (
  database: Database,
  sessionId: string,
  userId: string,
): Promise<SuccessSessionNode> => {
  const responsesRef = ref(database, `quizSessions/${sessionId}/responsesByUser/${userId}`);
  const snapshot = await get(responsesRef);
  if (!snapshot.exists()) {
    return {
      status: 'invited',
      updatedAt: '',
      responses: [],
    };
  }

  const record = asRecord(snapshot.val());
  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((response) => asRecord(response))
        .map((response) => ({
          answeredAt: readString(response['answeredAt']),
        }))
        .filter((response) => Boolean(response.answeredAt))
    : [];

  return {
    status: readString(record['status']),
    updatedAt: readString(record['updatedAt']),
    responses,
  };
};

const getAnswerTimestamps = (node: SuccessSessionNode): string[] =>
  normalizeTimestampList(node.responses.map((response) => response.answeredAt));

@Injectable({
  providedIn: 'root',
})
export class SuccessProgressService {
  private readonly authService = inject(AuthService);
  private readonly database = inject(Database);
  private readonly injector = inject(Injector);
  private readonly userQuizSessionsService = inject(UserQuizSessionsService);
  private readonly quizCatalogService = inject(QuizCatalogService);
  private readonly liveCacheBuildPromises = new Map<string, Promise<SuccessProgressCache>>();

  readonly state$ = this.authService.authUser$.pipe(
    switchMap((currentUser) => {
      if (!currentUser) {
        return of<SuccessPageState>({
          ...EMPTY_PAGE_STATE,
          isLoading: false,
        });
      }

      return combineLatest([this.userQuizSessionsService.state$, this.watchCache(currentUser.uid)]).pipe(
        switchMap(([sessionsState, cache]) => {
          if (sessionsState.isLoading) {
            return of<SuccessPageState>({
              ...EMPTY_PAGE_STATE,
              isLoading: true,
            });
          }

          if (sessionsState.loadError && !cache) {
            return of<SuccessPageState>({
              ...EMPTY_PAGE_STATE,
              isLoading: false,
              loadError: sessionsState.loadError,
            });
          }

          const cacheResolution = cache
            ? Promise.resolve(cache)
            : this.loadOrBuildCache(currentUser.uid, sessionsState);

          return from(cacheResolution).pipe(
            map((resolvedCache) =>
              buildSuccessPageState(
                resolvedCache,
                this.buildLiveSnapshotsFromCacheOrSessions(resolvedCache, sessionsState),
                this.quizCatalogService,
              ),
            ),
          );
        }),
      );
    }),
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  async recordSessionSummary(summary: SuccessSessionSummary): Promise<void> {
    const normalizedSessionId = readString(summary.sessionId);
    const currentUser = await firstValueFrom(this.authService.authUser$);
    const normalizedUserId = currentUser?.uid?.trim() ?? '';
    if (!normalizedSessionId || !normalizedUserId) {
      return;
    }

    const cacheRef = ref(this.database, SUCCESS_CACHE_PATH(normalizedUserId));
    const snapshot = await get(cacheRef);
    const cache = snapshot.exists() ? normalizeSuccessCache(snapshot.val()) ?? buildEmptyCache() : buildEmptyCache();
    const answerTimeline = normalizeTimestampList([...cache.answerTimeline, summary.lastAnsweredAt]);
    const sessionsById = {
      ...cache.sessionsById,
      [normalizedSessionId]: summary,
    };

    await update(cacheRef, {
      version: SUCCESS_CACHE_VERSION,
      updatedAt: summary.updatedAt || summary.lastAnsweredAt,
      answerTimeline,
      sessionsById,
    } satisfies SuccessProgressCache);
  }

  async recordRawAnswerTimestamp(answerTimestamp: string): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.authUser$);
    const normalizedUserId = currentUser?.uid?.trim() ?? '';
    if (!normalizedUserId) {
      return;
    }

    const cacheRef = ref(this.database, SUCCESS_CACHE_PATH(normalizedUserId));
    const snapshot = await get(cacheRef);
    const cache = snapshot.exists() ? normalizeSuccessCache(snapshot.val()) ?? buildEmptyCache() : buildEmptyCache();

    await update(cacheRef, {
      version: SUCCESS_CACHE_VERSION,
      updatedAt: answerTimestamp,
      answerTimeline: normalizeTimestampList([...cache.answerTimeline, answerTimestamp]),
      sessionsById: cache.sessionsById,
    } satisfies SuccessProgressCache);
  }

  private watchCache(userId: string): Observable<SuccessProgressCache | null> {
    return new Observable<SuccessProgressCache | null>((subscriber) => {
      const cacheRef = ref(this.database, SUCCESS_CACHE_PATH(userId));
      const unsubscribe = onValue(
        cacheRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next(null);
            return;
          }

          subscriber.next(normalizeSuccessCache(snapshot.val()));
        },
        (error: unknown) => {
          console.error('Impossible de lire le cache des succès :', error);
          subscriber.next(null);
        },
      );

      return () => unsubscribe();
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  private async loadOrBuildCache(userId: string, sessionsState: UserQuizSessionsState): Promise<SuccessProgressCache> {
    const cacheKey = `${userId}:${[...sessionsState.upcomingQuiz, ...sessionsState.pastQuiz]
      .map((session) => `${session.sessionId}:${session.status}:${session.updatedAt}`)
      .join('|')}`;
    const currentBuild = this.liveCacheBuildPromises.get(cacheKey);
    if (currentBuild) {
      return currentBuild;
    }

    const buildPromise = this.buildCacheFromLiveSessions(userId, sessionsState).finally(() => {
      this.liveCacheBuildPromises.delete(cacheKey);
    });

    this.liveCacheBuildPromises.set(cacheKey, buildPromise);
    return buildPromise;
  }

  private async buildCacheFromLiveSessions(
    userId: string,
    sessionsState: UserQuizSessionsState,
  ): Promise<SuccessProgressCache> {
    const allSessions = [...sessionsState.upcomingQuiz, ...sessionsState.pastQuiz];
    const snapshots: SuccessLiveSessionSnapshot[] = [];

    for (const session of allSessions) {
      try {
        const snapshot = await this.buildLiveSnapshot(userId, session);
        if (snapshot) {
          snapshots.push(snapshot);
        }
      } catch (error: unknown) {
        console.error('Impossible de construire un succès depuis les sessions live :', error);
      }
    }

    const answerTimeline = snapshots.flatMap((snapshot) => snapshot.answerTimestamps);
    const cache = buildSuccessProgressCache(snapshots, answerTimeline);

    const cacheRef = ref(this.database, SUCCESS_CACHE_PATH(userId));
    await set(cacheRef, cache);

    return cache;
  }

  private async buildLiveSnapshot(
    userId: string,
    session: UserQuizSessionViewModel,
  ): Promise<SuccessLiveSessionSnapshot | null> {
    const normalizedQuizId = session.quizId.trim().toLowerCase() as QuizId;
    const answerNode = await readUserResponses(this.database, session.sessionId, userId);
    const answerTimestamps = getAnswerTimestamps(answerNode);

    switch (normalizedQuizId) {
      case 'attentes': {
        const module = await import('../quiz/attentes-session');
        const service = this.injector.get(module.AttentesSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromAttentes(session, stats, answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt, this.quizCatalogService),
          answerTimestamps,
        };
      }
      case 'autodetermination': {
        const module = await import('../quiz/autodetermination-session');
        const service = this.injector.get(module.AutodeterminationSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromAutodetermination(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      case 'besoins-acquis': {
        const module = await import('../quiz/besoins-acquis-session');
        const service = this.injector.get(module.BesoinsAcquisSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromBesoinsAcquis(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      case 'equite': {
        const module = await import('../quiz/equite-session');
        const service = this.injector.get(module.EquiteSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromEquite(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? session.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      case 'identite-pro': {
        const module = await import('../quiz/identite-pro-session');
        const service = this.injector.get(module.IdentiteProSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromIdentitePro(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      case 'pyramide-besoins': {
        const module = await import('../quiz/pyramide-besoins-session');
        const service = this.injector.get(module.PyramideBesoinsSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromPyramideBesoins(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      case 'theorie-x-y': {
        const module = await import('../quiz/theorie-x-y-session');
        const service = this.injector.get(module.TheorieXYSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromTheorieXY(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      case 'mimetisme': {
        const module = await import('../quiz/mimetisme-session');
        const service = this.injector.get(module.MimetismeSession);
        const stats = await service.getSessionStats(session.sessionId, userId);
        return {
          ...buildSessionSummaryFromMimetisme(
            session,
            stats,
            answerTimestamps[answerTimestamps.length - 1] ?? stats.updatedAt,
            this.quizCatalogService,
          ),
          answerTimestamps,
        };
      }
      default:
        return null;
    }
  }

  private buildLiveSnapshotsFromCacheOrSessions(
    cache: SuccessProgressCache,
    sessionsState: UserQuizSessionsState,
  ): SuccessLiveSessionSnapshot[] {
    const cachedSnapshotsById = new Map(
      Object.values(cache.sessionsById).map((snapshot) => [snapshot.sessionId, snapshot] as const),
    );

    return [...sessionsState.upcomingQuiz, ...sessionsState.pastQuiz].map((session) => {
      const cachedSnapshot = cachedSnapshotsById.get(session.sessionId);
      if (cachedSnapshot) {
        return {
          ...cachedSnapshot,
          answerTimestamps: cachedSnapshot.lastAnsweredAt ? [cachedSnapshot.lastAnsweredAt] : [],
        };
      }

      return {
        sessionId: session.sessionId,
        quizId: session.quizId.trim().toLowerCase() as QuizId,
        quizTitle: this.quizCatalogService.getQuizTitle(session.quizId),
        coverUrl: this.quizCatalogService.getQuiz(session.quizId).coverUrl,
        status: session.status,
        answeredCount: 0,
        totalCount: 0,
        updatedAt: session.updatedAt || session.createdAt,
        lastAnsweredAt: '',
        metrics: {},
        answerTimestamps: [],
      };
    });
  }

}
