import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class MimetismeSession {
  private readonly database = inject(Database);

  private atlasPromise: Promise<MimetismeAtlas> | null = null;

  async loadAtlas(): Promise<MimetismeAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/mimetisme.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossible de charger les modèles du quiz.');
        }

        const payload = (await response.json()) as unknown;
        return normalizeAtlas(payload);
      })
      .catch((error: unknown) => {
        this.atlasPromise = null;
        throw error;
      });

    return this.atlasPromise;
  }

  async getPromptForSession(sessionId: string, userId: string): Promise<MimetismePromptState> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);
    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const atlas = await this.loadAtlas();
    const currentNode = await this.readUserResponsesNode(normalizedSessionId, normalizedUserId, atlas);

    const advancedState = advanceUntilComparable(currentNode.rankingState, atlas.modeles.length);
    const snapshot = buildRankingSnapshot(advancedState.sortedModelIds, atlas);
    const isCompleted = advancedState.finished;
    const status: MimetismeUserStatus = isCompleted ? 'completed' : 'started';

    const hasStateChanged =
      !areRankingStatesEqual(currentNode.rankingState, advancedState) ||
      !areNumberArraysEqual(currentNode.ranking.orderedModelIds, snapshot.orderedModelIds) ||
      !areNumberArraysEqual(currentNode.ranking.orderedInspirationIds, snapshot.orderedInspirationIds) ||
      currentNode.status !== status;

    if (hasStateChanged) {
      const nowIso = new Date().toISOString();
      const userResponsesRef = ref(
        this.database,
        `quizSessions/${normalizedSessionId}/responsesByUser/${normalizedUserId}`,
      );
      await set(userResponsesRef, {
        ...currentNode,
        status,
        updatedAt: nowIso,
        rankingState: advancedState,
        ranking: snapshot,
      } satisfies MimetismeUserResponsesNode);
    }

    if (isCompleted) {
      return {
        pair: null,
        totalCount: atlas.modeles.length,
        rankedCount: advancedState.sortedModelIds.length,
        comparisonsCount: advancedState.comparisons,
        remainingCount: 0,
        isCompleted: true,
      };
    }

    const currentModelId = advancedState.currentModelId;
    const midIndex = currentMidIndex(advancedState);
    const comparedModelId = advancedState.sortedModelIds[midIndex];

    if (currentModelId === null || comparedModelId === undefined) {
      return {
        pair: null,
        totalCount: atlas.modeles.length,
        rankedCount: advancedState.sortedModelIds.length,
        comparisonsCount: advancedState.comparisons,
        remainingCount: Math.max(atlas.modeles.length - advancedState.sortedModelIds.length, 0),
        isCompleted: false,
      };
    }

    const modelA = atlas.modelById.get(currentModelId) ?? null;
    const modelB = atlas.modelById.get(comparedModelId) ?? null;

    if (!modelA || !modelB) {
      throw new Error('Impossible de préparer la comparaison des modèles.');
    }

    return {
      pair: {
        a: modelA,
        b: modelB,
      },
      totalCount: atlas.modeles.length,
      rankedCount: advancedState.sortedModelIds.length,
      comparisonsCount: advancedState.comparisons,
      remainingCount: Math.max(atlas.modeles.length - advancedState.sortedModelIds.length, 0),
      isCompleted: false,
    };
  }

  async submitChoice(
    sessionId: string,
    userId: string,
    choice: MimetismeChoiceInput,
  ): Promise<MimetismeSubmitChoiceResult> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);
    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const atlas = await this.loadAtlas();
    const currentNode = await this.readUserResponsesNode(normalizedSessionId, normalizedUserId, atlas);
    let rankingState = advanceUntilComparable(currentNode.rankingState, atlas.modeles.length);

    if (rankingState.finished) {
      return {
        rankedCount: rankingState.sortedModelIds.length,
        comparisonsCount: rankingState.comparisons,
        remainingCount: 0,
        isCompleted: true,
      };
    }

    const currentModelId = rankingState.currentModelId;
    const midIndex = currentMidIndex(rankingState);
    const comparedModelId = rankingState.sortedModelIds[midIndex];

    if (currentModelId === null || comparedModelId === undefined) {
      throw new Error('Aucune comparaison active.');
    }

    const normalizedPreferredModelId = choice.preferredModelId;
    const normalizedOtherModelId = choice.otherModelId;

    const selectedCurrentModel =
      normalizedPreferredModelId === currentModelId && normalizedOtherModelId === comparedModelId;
    const selectedComparedModel =
      normalizedPreferredModelId === comparedModelId && normalizedOtherModelId === currentModelId;

    if (!selectedCurrentModel && !selectedComparedModel) {
      throw new Error('Cette comparaison est expirée, recharge la question suivante.');
    }

    rankingState = {
      ...rankingState,
      comparisons: rankingState.comparisons + 1,
      high: selectedCurrentModel ? midIndex : rankingState.high,
      low: selectedComparedModel ? midIndex + 1 : rankingState.low,
    };

    if (rankingState.low >= rankingState.high) {
      rankingState = insertCurrentModel(rankingState, rankingState.low);
    }

    rankingState = advanceUntilComparable(rankingState, atlas.modeles.length);

    const nowIso = new Date().toISOString();
    const preferredModel = atlas.modelById.get(normalizedPreferredModelId);
    const otherModel = atlas.modelById.get(normalizedOtherModelId);
    if (!preferredModel || !otherModel) {
      throw new Error('Modèle introuvable.');
    }

    const updatedResponses = [
      ...currentNode.responses,
      {
        quizId: MIMETISME_QUIZ_ID,
        preferredModelId: normalizedPreferredModelId,
        otherModelId: normalizedOtherModelId,
        preferredInspirationId: preferredModel.inspiration,
        otherInspirationId: otherModel.inspiration,
        answeredAt: nowIso,
      } satisfies MimetismeChoiceEntry,
    ];

    const snapshot = buildRankingSnapshot(rankingState.sortedModelIds, atlas);
    const isCompleted = rankingState.finished;
    const status: MimetismeUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: MimetismeUserResponsesNode = {
      ...currentNode,
      status,
      updatedAt: nowIso,
      responses: updatedResponses,
      rankingState,
      ranking: snapshot,
    };

    const userResponsesRef = ref(
      this.database,
      `quizSessions/${normalizedSessionId}/responsesByUser/${normalizedUserId}`,
    );
    await set(userResponsesRef, nodeToWrite);

    return {
      rankedCount: rankingState.sortedModelIds.length,
      comparisonsCount: rankingState.comparisons,
      remainingCount: Math.max(atlas.modeles.length - rankingState.sortedModelIds.length, 0),
      isCompleted,
    };
  }

  async getSessionStats(sessionId: string, userId: string): Promise<MimetismeSessionStats> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const atlas = await this.loadAtlas();
    const userNode = await this.readUserResponsesNode(normalizedSessionId, normalizedUserId, atlas);

    const orderedModelIdsRaw =
      userNode.ranking.orderedModelIds.length > 0
        ? userNode.ranking.orderedModelIds
        : userNode.rankingState.sortedModelIds;
    const orderedModelIds = orderedModelIdsRaw.filter(
      (modelId, index, source) => source.indexOf(modelId) === index && atlas.modelById.has(modelId),
    );

    const totalCount = atlas.modeles.length;
    const rankedCount = orderedModelIds.length;
    const totalPoints = (totalCount * (totalCount + 1)) / 2;
    const pointsByInspirationId = new Map<number, number>();
    const rankedCountByInspirationId = new Map<number, number>();
    const modelCountByInspirationId = new Map<number, number>();

    atlas.modeles.forEach((model) => {
      const currentCount = modelCountByInspirationId.get(model.inspiration) ?? 0;
      modelCountByInspirationId.set(model.inspiration, currentCount + 1);
    });

    orderedModelIds.forEach((modelId, index) => {
      const model = atlas.modelById.get(modelId);
      if (!model) {
        return;
      }

      const points = totalCount - index;
      const currentPoints = pointsByInspirationId.get(model.inspiration) ?? 0;
      pointsByInspirationId.set(model.inspiration, currentPoints + points);

      const currentRankedCount = rankedCountByInspirationId.get(model.inspiration) ?? 0;
      rankedCountByInspirationId.set(model.inspiration, currentRankedCount + 1);
    });

    const dimensions = atlas.inspirations.map((inspiration) => {
      const modelCount = modelCountByInspirationId.get(inspiration.id) ?? 0;
      const inspirationRankedCount = rankedCountByInspirationId.get(inspiration.id) ?? 0;
      const points = pointsByInspirationId.get(inspiration.id) ?? 0;
      const score = totalPoints > 0 ? (points / totalPoints) * 100 : 0;

      return {
        id: inspiration.id,
        label: inspiration.label,
        modelCount,
        rankedCount: inspirationRankedCount,
        score: Number(clampToRange(score, 0, 100).toFixed(2)),
      } satisfies MimetismeInspirationScore;
    });

    return {
      title: atlas.title || 'Mimetisme',
      labels: dimensions.map((dimension) => dimension.label),
      scores: dimensions.map((dimension) => dimension.score),
      dimensions,
      rankedCount,
      totalCount,
      remainingCount: Math.max(totalCount - rankedCount, 0),
      isCompleted: rankedCount >= totalCount,
      updatedAt: userNode.updatedAt,
    };
  }

  async pickRandomNextEligibleSession(
    userId: string,
    currentSessionId: string,
  ): Promise<MimetismeEligibleSession | null> {
    const normalizedUserId = readString(userId);
    const normalizedCurrentSessionId = readString(currentSessionId);

    if (!normalizedUserId) {
      return null;
    }

    const userSessionsRef = ref(this.database, `users/${normalizedUserId}/quizSessions`);
    const userSessionsSnapshot = await get(userSessionsRef);
    if (!userSessionsSnapshot.exists()) {
      return null;
    }

    const rawSessions = asRecord(userSessionsSnapshot.val());
    const sessionSummaries = Object.entries(rawSessions)
      .map(([id, rawSession]) => normalizeUserSession(id, rawSession))
      .filter((session) => session.sessionId && session.quizId)
      .filter((session) => !normalizedCurrentSessionId || session.sessionId !== normalizedCurrentSessionId)
      .filter((session) => !isExpired(session.responseDeadline));

    if (sessionSummaries.length === 0) {
      return null;
    }

    const checkedSessions = await Promise.all(
      sessionSummaries.map(async (session) => {
        const userNode = await this.readUserResponsesNodeRaw(session.sessionId, normalizedUserId);
        const userNodeRecord = asRecord(userNode);
        const normalizedStatus = readString(userNodeRecord['status']).toLowerCase();
        return {
          session,
          isCompleted: normalizedStatus === 'completed',
        };
      }),
    );

    const candidates = checkedSessions
      .filter((item) => !item.isCompleted)
      .map((item) => ({
        sessionId: item.session.sessionId,
        quizId: item.session.quizId,
      }));

    if (candidates.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex] ?? null;
  }

  private async readUserResponsesNode(
    sessionId: string,
    userId: string,
    atlas: MimetismeAtlas,
  ): Promise<MimetismeUserResponsesNode> {
    const rawNode = await this.readUserResponsesNodeRaw(sessionId, userId);
    return normalizeUserResponsesNode(rawNode, atlas);
  }

  private async readUserResponsesNodeRaw(sessionId: string, userId: string): Promise<unknown> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      return null;
    }

    const userResponsesRef = ref(
      this.database,
      `quizSessions/${normalizedSessionId}/responsesByUser/${normalizedUserId}`,
    );
    const snapshot = await get(userResponsesRef);

    return snapshot.exists() ? snapshot.val() : null;
  }
}

const MIMETISME_QUIZ_ID = 'mimetisme';

type MimetismeUserStatus = 'invited' | 'started' | 'completed';

export interface MimetismeModele {
  id: number;
  personnage: string;
  portrait: string;
  inspiration: number;
}

interface MimetismeInspiration {
  id: number;
  label: string;
}

interface MimetismeAtlas {
  title: string;
  modeles: MimetismeModele[];
  inspirations: MimetismeInspiration[];
  modelById: Map<number, MimetismeModele>;
}

interface MimetismeRankingState {
  sortedModelIds: number[];
  pendingModelIds: number[];
  currentModelId: number | null;
  low: number;
  high: number;
  comparisons: number;
  finished: boolean;
}

interface MimetismeRankingSnapshot {
  orderedModelIds: number[];
  orderedInspirationIds: number[];
}

export interface MimetismeChoiceEntry {
  quizId: string;
  preferredModelId: number;
  otherModelId: number;
  preferredInspirationId: number;
  otherInspirationId: number;
  answeredAt: string;
}

interface MimetismeUserResponsesNode {
  status: MimetismeUserStatus;
  updatedAt: string;
  responses: MimetismeChoiceEntry[];
  rankingState: MimetismeRankingState;
  ranking: MimetismeRankingSnapshot;
}

export interface MimetismePromptPair {
  a: MimetismeModele;
  b: MimetismeModele;
}

export interface MimetismePromptState {
  pair: MimetismePromptPair | null;
  totalCount: number;
  rankedCount: number;
  comparisonsCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface MimetismeChoiceInput {
  preferredModelId: number;
  otherModelId: number;
}

export interface MimetismeSubmitChoiceResult {
  rankedCount: number;
  comparisonsCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface MimetismeInspirationScore {
  id: number;
  label: string;
  modelCount: number;
  rankedCount: number;
  score: number;
}

export interface MimetismeSessionStats {
  title: string;
  labels: string[];
  scores: number[];
  dimensions: MimetismeInspirationScore[];
  rankedCount: number;
  totalCount: number;
  remainingCount: number;
  isCompleted: boolean;
  updatedAt: string;
}

interface MimetismeEligibleSession {
  sessionId: string;
  quizId: string;
}

interface UserSessionSummary {
  sessionId: string;
  quizId: string;
  responseDeadline: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string => String(value ?? '').trim();

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAtlas = (payload: unknown): MimetismeAtlas => {
  const record = asRecord(payload);

  const inspirations = Array.isArray(record['inspiration'])
    ? record['inspiration']
        .map((rawInspiration) => {
          const inspirationRecord = asRecord(rawInspiration);
          const id = readNumber(inspirationRecord['id']);
          if (id === null) {
            return null;
          }

          return {
            id,
            label: readString(inspirationRecord['label']),
          } satisfies MimetismeInspiration;
        })
        .filter((inspiration): inspiration is MimetismeInspiration => inspiration !== null)
    : [];

  const modeles = Array.isArray(record['modèles'])
    ? record['modèles']
        .map((rawModele) => {
          const modeleRecord = asRecord(rawModele);
          const id = readNumber(modeleRecord['id']);
          const inspiration = readNumber(modeleRecord['inspiration']);

          if (id === null || inspiration === null) {
            return null;
          }

          return {
            id,
            personnage: readString(modeleRecord['personnage']),
            portrait: readString(modeleRecord['portrait']),
            inspiration,
          } satisfies MimetismeModele;
        })
        .filter((modele): modele is MimetismeModele => modele !== null)
    : [];

  const modelById = new Map(modeles.map((modele) => [modele.id, modele]));

  return {
    title: readString(record['titre']),
    modeles,
    inspirations,
    modelById,
  };
};

const createInitialRankingState = (modelIds: number[]): MimetismeRankingState => ({
  sortedModelIds: [],
  pendingModelIds: shuffle(modelIds),
  currentModelId: null,
  low: 0,
  high: 0,
  comparisons: 0,
  finished: modelIds.length === 0,
});

const normalizeChoiceEntry = (payload: unknown): MimetismeChoiceEntry | null => {
  const record = asRecord(payload);
  const preferredModelId = readNumber(record['preferredModelId']);
  const otherModelId = readNumber(record['otherModelId']);
  const preferredInspirationId = readNumber(record['preferredInspirationId']);
  const otherInspirationId = readNumber(record['otherInspirationId']);

  if (
    preferredModelId === null ||
    otherModelId === null ||
    preferredInspirationId === null ||
    otherInspirationId === null
  ) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    preferredModelId,
    otherModelId,
    preferredInspirationId,
    otherInspirationId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown, atlas: MimetismeAtlas): MimetismeUserResponsesNode => {
  const record = asRecord(payload);
  const atlasIds = atlas.modeles.map((modele) => modele.id);
  const atlasIdSet = new Set<number>(atlasIds);

  const rawStatus = readString(record['status']).toLowerCase();
  const status: MimetismeUserStatus =
    rawStatus === 'started' || rawStatus === 'completed' ? rawStatus : 'invited';

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawEntry) => normalizeChoiceEntry(rawEntry))
        .filter((entry): entry is MimetismeChoiceEntry => entry !== null)
    : [];

  const rankingState = normalizeRankingState(record['rankingState'], atlasIds, atlasIdSet);
  const ranking = normalizeRankingSnapshot(record['ranking'], rankingState.sortedModelIds, atlas);

  return {
    status,
    updatedAt: readString(record['updatedAt']),
    responses,
    rankingState,
    ranking,
  };
};

const normalizeRankingState = (
  payload: unknown,
  atlasIds: number[],
  atlasIdSet: Set<number>,
): MimetismeRankingState => {
  const record = asRecord(payload);

  const sortedModelIds = normalizeNumberArray(record['sortedModelIds']).filter((id, index, source) => {
    return atlasIdSet.has(id) && source.indexOf(id) === index;
  });
  const usedIds = new Set<number>(sortedModelIds);

  const pendingModelIds = normalizeNumberArray(record['pendingModelIds']).filter((id, index, source) => {
    if (!atlasIdSet.has(id) || usedIds.has(id) || source.indexOf(id) !== index) {
      return false;
    }

    return true;
  });
  const pendingIdsSet = new Set<number>(pendingModelIds);

  const rawCurrentModelId = readNumber(record['currentModelId']);
  const currentModelId =
    rawCurrentModelId !== null &&
    atlasIdSet.has(rawCurrentModelId) &&
    !usedIds.has(rawCurrentModelId) &&
    !pendingIdsSet.has(rawCurrentModelId)
      ? rawCurrentModelId
      : null;

  atlasIds.forEach((id) => {
    if (usedIds.has(id) || pendingIdsSet.has(id) || id === currentModelId) {
      return;
    }
    pendingModelIds.push(id);
    pendingIdsSet.add(id);
  });

  const low = clampToRange(readNumber(record['low']) ?? 0, 0, sortedModelIds.length);
  const high = clampToRange(readNumber(record['high']) ?? sortedModelIds.length, low, sortedModelIds.length);
  const comparisons = Math.max(readNumber(record['comparisons']) ?? 0, 0);
  const finished =
    (readBoolean(record['finished']) ?? false) &&
    currentModelId === null &&
    pendingModelIds.length === 0 &&
    sortedModelIds.length >= atlasIds.length;

  if (!record || Object.keys(record).length === 0) {
    return createInitialRankingState(atlasIds);
  }

  return {
    sortedModelIds,
    pendingModelIds,
    currentModelId,
    low,
    high,
    comparisons,
    finished,
  };
};

const normalizeRankingSnapshot = (
  payload: unknown,
  fallbackOrderedModelIds: number[],
  atlas: MimetismeAtlas,
): MimetismeRankingSnapshot => {
  const record = asRecord(payload);

  const orderedModelIdsRaw = normalizeNumberArray(record['orderedModelIds']);
  const orderedModelIds =
    orderedModelIdsRaw.length > 0
      ? orderedModelIdsRaw.filter((id, index, source) => source.indexOf(id) === index && atlas.modelById.has(id))
      : [...fallbackOrderedModelIds];

  const orderedInspirationIdsRaw = normalizeNumberArray(record['orderedInspirationIds']);
  const orderedInspirationIds =
    orderedInspirationIdsRaw.length > 0
      ? orderedInspirationIdsRaw.filter((id, index, source) => source.indexOf(id) === index)
      : extractOrderedInspirationIds(orderedModelIds, atlas);

  return {
    orderedModelIds,
    orderedInspirationIds,
  };
};

const normalizeNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((item) => readNumber(item))
        .filter((item): item is number => item !== null)
    : [];

const readBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
};

const clampToRange = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const advanceUntilComparable = (state: MimetismeRankingState, totalModels: number): MimetismeRankingState => {
  let nextState = { ...state };
  let safety = 0;

  while (safety < 256) {
    safety += 1;

    if (nextState.finished) {
      return normalizeCompletion(nextState, totalModels);
    }

    if (nextState.currentModelId === null) {
      if (nextState.pendingModelIds.length === 0) {
        nextState = {
          ...nextState,
          finished: true,
        };
        return normalizeCompletion(nextState, totalModels);
      }

      const [nextModelId, ...remainingPendingIds] = nextState.pendingModelIds;
      nextState = {
        ...nextState,
        currentModelId: nextModelId ?? null,
        pendingModelIds: remainingPendingIds,
        low: 0,
        high: nextState.sortedModelIds.length,
      };

      if (nextState.currentModelId === null) {
        nextState = {
          ...nextState,
          finished: true,
        };
        return normalizeCompletion(nextState, totalModels);
      }
    }

    if (nextState.sortedModelIds.length === 0) {
      nextState = insertCurrentModel(nextState, 0);
      continue;
    }

    const low = clampToRange(nextState.low, 0, nextState.sortedModelIds.length);
    const high = clampToRange(nextState.high, low, nextState.sortedModelIds.length);
    if (low !== nextState.low || high !== nextState.high) {
      nextState = {
        ...nextState,
        low,
        high,
      };
    }

    if (nextState.low >= nextState.high) {
      nextState = insertCurrentModel(nextState, nextState.low);
      continue;
    }

    const mid = currentMidIndex(nextState);
    if (mid < 0 || mid >= nextState.sortedModelIds.length) {
      nextState = insertCurrentModel(nextState, nextState.low);
      continue;
    }

    return normalizeCompletion(nextState, totalModels);
  }

  return normalizeCompletion(nextState, totalModels);
};

const insertCurrentModel = (state: MimetismeRankingState, insertAt: number): MimetismeRankingState => {
  if (state.currentModelId === null) {
    return state;
  }

  const index = clampToRange(insertAt, 0, state.sortedModelIds.length);
  const updatedSorted = [...state.sortedModelIds];
  updatedSorted.splice(index, 0, state.currentModelId);

  return {
    ...state,
    sortedModelIds: updatedSorted,
    currentModelId: null,
    low: 0,
    high: 0,
  };
};

const normalizeCompletion = (state: MimetismeRankingState, totalModels: number): MimetismeRankingState => {
  const isFinished =
    state.currentModelId === null &&
    state.pendingModelIds.length === 0 &&
    state.sortedModelIds.length >= totalModels;

  return {
    ...state,
    finished: isFinished,
  };
};

const currentMidIndex = (state: MimetismeRankingState): number => Math.floor((state.low + state.high) / 2);

const buildRankingSnapshot = (
  orderedModelIds: number[],
  atlas: MimetismeAtlas,
): MimetismeRankingSnapshot => ({
  orderedModelIds: [...orderedModelIds],
  orderedInspirationIds: extractOrderedInspirationIds(orderedModelIds, atlas),
});

const extractOrderedInspirationIds = (orderedModelIds: number[], atlas: MimetismeAtlas): number[] => {
  const seen = new Set<number>();
  const ids: number[] = [];

  orderedModelIds.forEach((modelId) => {
    const inspirationId = atlas.modelById.get(modelId)?.inspiration;
    if (inspirationId === undefined || seen.has(inspirationId)) {
      return;
    }

    seen.add(inspirationId);
    ids.push(inspirationId);
  });

  return ids;
};

const areRankingStatesEqual = (a: MimetismeRankingState, b: MimetismeRankingState): boolean =>
  a.currentModelId === b.currentModelId &&
  a.low === b.low &&
  a.high === b.high &&
  a.comparisons === b.comparisons &&
  a.finished === b.finished &&
  areNumberArraysEqual(a.sortedModelIds, b.sortedModelIds) &&
  areNumberArraysEqual(a.pendingModelIds, b.pendingModelIds);

const areNumberArraysEqual = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
};

const shuffle = (values: number[]): number[] => {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const currentValue = shuffled[i];
    shuffled[i] = shuffled[j] ?? currentValue;
    shuffled[j] = currentValue;
  }

  return shuffled;
};

const normalizeUserSession = (sessionKey: string, payload: unknown): UserSessionSummary => {
  const record = asRecord(payload);

  return {
    sessionId: readString(record['sessionId']) || readString(sessionKey),
    quizId: readString(record['quizId']).toLowerCase(),
    responseDeadline: readString(record['responseDeadline']),
  };
};

const isExpired = (deadline: string): boolean => {
  const normalizedDeadline = readString(deadline);
  if (!normalizedDeadline) {
    return false;
  }

  const deadlineTimestamp = new Date(normalizedDeadline).getTime();
  if (!Number.isFinite(deadlineTimestamp)) {
    return false;
  }

  return deadlineTimestamp < Date.now();
};
