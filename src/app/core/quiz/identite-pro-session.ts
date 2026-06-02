import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class IdentiteProSession {
  private readonly database = inject(Database);

  private atlasPromise: Promise<IdentiteProAtlas> | null = null;

  async loadAtlas(): Promise<IdentiteProAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/identite-pro.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossible de charger les traits du quiz.');
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

  async getPromptForSession(
    sessionId: string,
    userId: string,
  ): Promise<IdentiteProPromptState> {
    const [atlas, responsesByUser] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(sessionId, userId),
    ]);

    const allQuestionKeys = new Set(buildAllQuestionKeys(atlas));
    const answeredKeys = getAnsweredQuestionKeys(responsesByUser.responses);
    const remainingQuestionKeys = [...allQuestionKeys].filter((key) => !answeredKeys.has(key));
    const remainingQuestions = remainingQuestionKeys
      .map((key) => parseQuestionKey(key, atlas))
      .filter((question): question is IdentiteProPromptQuestion => question !== null);

    const totalCount = allQuestionKeys.size;
    const answeredCount = Math.min(answeredKeys.size, totalCount);

    if (remainingQuestions.length === 0) {
      return {
        question: null,
        totalCount,
        answeredCount,
        remainingCount: 0,
        isCompleted: true,
      };
    }

    const randomIndex = Math.floor(Math.random() * remainingQuestions.length);
    const randomQuestion = remainingQuestions[randomIndex] ?? null;

    return {
      question: randomQuestion,
      totalCount,
      answeredCount,
      remainingCount: remainingQuestions.length,
      isCompleted: false,
    };
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    answer: IdentiteProAnswerInput,
  ): Promise<IdentiteProSubmitAnswerResult> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, currentNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const matchedDimension = atlas.dimensionById.get(answer.dimensionId);
    if (!matchedDimension) {
      throw new Error("Dimension d'identité introuvable.");
    }

    const matchedTrait = atlas.traitById.get(answer.traitId);
    if (!matchedTrait) {
      throw new Error('Trait introuvable.');
    }

    const matchedTheme = atlas.themeById.get(answer.themeId);
    if (!matchedTheme) {
      throw new Error('Thème introuvable.');
    }

    if (matchedTrait.theme !== answer.themeId) {
      throw new Error('Le thème associé au trait est invalide.');
    }

    const matchedResponse = atlas.responseById.get(answer.responseId);
    if (!matchedResponse) {
      throw new Error('Réponse introuvable.');
    }

    const normalizedExistingResponses = dedupeResponses(currentNode.responses);
    const questionKey = buildQuestionKey(answer.dimensionId, answer.traitId);
    const alreadyAnswered = normalizedExistingResponses.some(
      (response) =>
        response.quizId === IDENTITE_PRO_QUIZ_ID &&
        buildQuestionKey(response.dimensionId, response.traitId) === questionKey,
    );

    const nowIso = new Date().toISOString();
    const updatedResponses = alreadyAnswered
      ? normalizedExistingResponses
      : [
          ...normalizedExistingResponses,
          {
            quizId: IDENTITE_PRO_QUIZ_ID,
            dimensionId: answer.dimensionId,
            traitId: answer.traitId,
            themeId: answer.themeId,
            responseId: answer.responseId,
            answeredAt: nowIso,
          },
        ];

    const totalCount = buildAllQuestionKeys(atlas).length;
    const answeredKeys = getAnsweredQuestionKeys(updatedResponses);
    const answeredCount = Math.min(answeredKeys.size, totalCount);
    const isCompleted = answeredCount >= totalCount;
    const status: IdentiteProUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: IdentiteProUserResponsesNode = {
      ...currentNode,
      status,
      updatedAt: nowIso,
      responses: updatedResponses,
    };

    const userResponsesRef = ref(
      this.database,
      `quizSessions/${normalizedSessionId}/responsesByUser/${normalizedUserId}`,
    );
    await set(userResponsesRef, nodeToWrite);

    return {
      answeredCount,
      remainingCount: Math.max(totalCount - answeredCount, 0),
      isCompleted,
    };
  }

  async getSessionStats(sessionId: string, userId: string): Promise<IdentiteProSessionStats> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, userNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const traitById = atlas.traitById;
    const responseById = atlas.responseById;
    const themeById = atlas.themeById;
    const dimensionByKey = atlas.dimensionByKey;

    const valuesByThemeAndDimensionId = new Map<number, Map<number, number[]>>();
    const answeredQuestionKeysByTheme = new Map<number, Set<string>>();

    dedupeResponses(userNode.responses)
      .filter((response) => response.quizId === IDENTITE_PRO_QUIZ_ID)
      .forEach((responseEntry) => {
        const matchedTheme = themeById.get(responseEntry.themeId);
        const matchedTrait = traitById.get(responseEntry.traitId);
        const matchedResponse = responseById.get(responseEntry.responseId);
        const matchedDimension = atlas.dimensionById.get(responseEntry.dimensionId);

        if (!matchedTheme || !matchedTrait || !matchedResponse || !matchedDimension) {
          return;
        }

        if (matchedTrait.theme !== responseEntry.themeId) {
          return;
        }

        const normalizedDimensionKey = getDimensionKey(matchedDimension);
        if (!isIdentiteProDimensionKey(normalizedDimensionKey)) {
          return;
        }

        const themeValues =
          valuesByThemeAndDimensionId.get(matchedTheme.id) ?? new Map<number, number[]>();
        const currentValues = themeValues.get(matchedDimension.id) ?? [];
        currentValues.push(matchedResponse.valeur);
        themeValues.set(matchedDimension.id, currentValues);
        valuesByThemeAndDimensionId.set(matchedTheme.id, themeValues);

        const answeredKeys = answeredQuestionKeysByTheme.get(matchedTheme.id) ?? new Set<string>();
        answeredKeys.add(buildQuestionKey(responseEntry.dimensionId, responseEntry.traitId));
        answeredQuestionKeysByTheme.set(matchedTheme.id, answeredKeys);
      });

    const totalCount = atlas.dimensionsIdentite.length * atlas.traits.length;
    const answeredCount = new Set(
      dedupeResponses(userNode.responses)
        .filter((response) => response.quizId === IDENTITE_PRO_QUIZ_ID)
        .map((response) => buildQuestionKey(response.dimensionId, response.traitId)),
    ).size;

    const themes = atlas.themes.map((theme) => {
      const themeValues = valuesByThemeAndDimensionId.get(theme.id) ?? new Map<number, number[]>();

      const identiteDeSoiDimension =
        dimensionByKey.get('identite_de_soi') ?? atlas.dimensionsIdentite[0] ?? null;
      const identitePercueDimension =
        dimensionByKey.get('identite_percue') ?? atlas.dimensionsIdentite[1] ?? null;

      const identiteDeSoiValues =
        identiteDeSoiDimension !== null ? themeValues.get(identiteDeSoiDimension.id) ?? [] : [];
      const identitePercueValues =
        identitePercueDimension !== null ? themeValues.get(identitePercueDimension.id) ?? [] : [];

      const identiteDeSoiStats = identiteDeSoiDimension
        ? {
            dimensionId: identiteDeSoiDimension.id,
            key: identiteDeSoiDimension.key,
            label: identiteDeSoiDimension.label,
            responseCount: identiteDeSoiValues.length,
            averageValue: Number(averageValues(identiteDeSoiValues).toFixed(2)),
          }
        : buildEmptyDimensionStats({
            id: 0,
            key: 'identite_de_soi',
            label: 'Je suis...',
          });

      const identitePercueStats = identitePercueDimension
        ? {
            dimensionId: identitePercueDimension.id,
            key: identitePercueDimension.key,
            label: identitePercueDimension.label,
            responseCount: identitePercueValues.length,
            averageValue: Number(averageValues(identitePercueValues).toFixed(2)),
          }
        : buildEmptyDimensionStats({
            id: 0,
            key: 'identite_percue',
            label: 'Au travail, je suis perçu comme...',
          });

      return {
        themeId: theme.id,
        label: theme.label,
        traitCount: atlas.traits.filter((trait) => trait.theme === theme.id).length,
        answeredCount: answeredQuestionKeysByTheme.get(theme.id)?.size ?? 0,
        identiteDeSoi: identiteDeSoiStats,
        identitePercue: identitePercueStats,
      } satisfies IdentiteProThemeStats;
    });

    return {
      title: atlas.titre || atlas.nom || 'Identité Pro',
      totalCount,
      answeredCount,
      remainingCount: Math.max(totalCount - answeredCount, 0),
      themes,
      updatedAt: userNode.updatedAt,
    };
  }

  async pickRandomNextEligibleSession(
    userId: string,
    currentSessionId: string,
  ): Promise<IdentiteProEligibleSession | null> {
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
        const userNode = await this.readUserResponsesNode(session.sessionId, normalizedUserId);
        return {
          session,
          isCompleted: userNode.status === 'completed',
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
  ): Promise<IdentiteProUserResponsesNode> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      return {
        status: 'invited',
        updatedAt: '',
        responses: [],
      };
    }

    const userResponsesRef = ref(
      this.database,
      `quizSessions/${normalizedSessionId}/responsesByUser/${normalizedUserId}`,
    );
    const snapshot = await get(userResponsesRef);

    if (!snapshot.exists()) {
      return {
        status: 'invited',
        updatedAt: '',
        responses: [],
      };
    }

    return normalizeUserResponsesNode(snapshot.val());
  }
}

const IDENTITE_PRO_QUIZ_ID = 'identite-pro';

type IdentiteProUserStatus = 'invited' | 'started' | 'completed';

interface IdentiteProTheme {
  id: number;
  label: string;
}

interface IdentiteProDimension {
  id: number;
  key: string;
  label: string;
}

interface IdentiteProResponse {
  id: number;
  valeur: number;
  label: string;
}

export interface IdentiteProTrait {
  id: number;
  label: string;
  image: string;
  theme: number;
}

export interface IdentiteProPromptQuestion {
  dimension: IdentiteProDimension;
  trait: IdentiteProTrait;
}

export interface IdentiteProAtlas {
  nom: string;
  titre: string;
  dimensionsIdentite: IdentiteProDimension[];
  themes: IdentiteProTheme[];
  reponses: IdentiteProResponse[];
  traits: IdentiteProTrait[];
  dimensionById: Map<number, IdentiteProDimension>;
  dimensionByKey: Map<string, IdentiteProDimension>;
  themeById: Map<number, IdentiteProTheme>;
  responseById: Map<number, IdentiteProResponse>;
  traitById: Map<number, IdentiteProTrait>;
}

export interface IdentiteProAnswerInput {
  dimensionId: number;
  traitId: number;
  themeId: number;
  responseId: number;
}

export interface IdentiteProAnswerEntry {
  quizId: string;
  dimensionId: number;
  traitId: number;
  themeId: number;
  responseId: number;
  answeredAt: string;
}

interface IdentiteProUserResponsesNode {
  status: IdentiteProUserStatus;
  updatedAt: string;
  responses: IdentiteProAnswerEntry[];
}

export interface IdentiteProPromptState {
  question: IdentiteProPromptQuestion | null;
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface IdentiteProSubmitAnswerResult {
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface IdentiteProDimensionStats {
  dimensionId: number;
  key: string;
  label: string;
  responseCount: number;
  averageValue: number;
}

export interface IdentiteProThemeStats {
  themeId: number;
  label: string;
  traitCount: number;
  answeredCount: number;
  identiteDeSoi: IdentiteProDimensionStats;
  identitePercue: IdentiteProDimensionStats;
}

export interface IdentiteProSessionStats {
  title: string;
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  themes: IdentiteProThemeStats[];
  updatedAt: string;
}

interface IdentiteProEligibleSession {
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

const normalizeAtlas = (payload: unknown): IdentiteProAtlas => {
  const record = asRecord(payload);

  const dimensionsIdentite = Array.isArray(record['dimensions_identite'])
    ? record['dimensions_identite']
        .map((rawDimension) => {
          const dimensionRecord = asRecord(rawDimension);
          const id = readNumber(dimensionRecord['id']);
          if (id === null) {
            return null;
          }

          return {
            id,
            key: readString(dimensionRecord['key']),
            label: readString(dimensionRecord['label']),
          } satisfies IdentiteProDimension;
        })
        .filter((dimension): dimension is IdentiteProDimension => dimension !== null)
    : [];

  const themes = Array.isArray(record['themes'])
    ? record['themes']
        .map((rawTheme) => {
          const themeRecord = asRecord(rawTheme);
          const id = readNumber(themeRecord['id']);
          if (id === null) {
            return null;
          }

          return {
            id,
            label: readString(themeRecord['label']),
          } satisfies IdentiteProTheme;
        })
        .filter((theme): theme is IdentiteProTheme => theme !== null)
    : [];

  const reponses = Array.isArray(record['reponses'])
    ? record['reponses']
        .map((rawResponse) => {
          const responseRecord = asRecord(rawResponse);
          const id = readNumber(responseRecord['id']);
          const valeur = readNumber(responseRecord['valeur']);
          if (id === null || valeur === null) {
            return null;
          }

          return {
            id,
            valeur,
            label: readString(responseRecord['label']),
          } satisfies IdentiteProResponse;
        })
        .filter((response): response is IdentiteProResponse => response !== null)
    : [];

  const traits = Array.isArray(record['traits'])
    ? record['traits']
        .map((rawTrait) => {
          const traitRecord = asRecord(rawTrait);
          const id = readNumber(traitRecord['id']);
          const theme = readNumber(traitRecord['theme']);
          if (id === null || theme === null) {
            return null;
          }

          return {
            id,
            label: readString(traitRecord['label']),
            image: readString(traitRecord['image']),
            theme,
          } satisfies IdentiteProTrait;
        })
        .filter((trait): trait is IdentiteProTrait => trait !== null)
    : [];

  return {
    nom: readString(record['nom']),
    titre: readString(record['titre']),
    dimensionsIdentite,
    themes,
    reponses,
    traits,
    dimensionById: new Map(dimensionsIdentite.map((dimension) => [dimension.id, dimension])),
    dimensionByKey: new Map(
      dimensionsIdentite.map((dimension) => [dimension.key.trim().toLowerCase(), dimension]),
    ),
    themeById: new Map(themes.map((theme) => [theme.id, theme])),
    responseById: new Map(reponses.map((response) => [response.id, response])),
    traitById: new Map(traits.map((trait) => [trait.id, trait])),
  };
};

const normalizeAnswerEntry = (payload: unknown): IdentiteProAnswerEntry | null => {
  const record = asRecord(payload);
  const dimensionId = readNumber(record['dimensionId']);
  const traitId = readNumber(record['traitId']);
  const themeId = readNumber(record['themeId']);
  const responseId = readNumber(record['responseId']);

  if (dimensionId === null || traitId === null || themeId === null || responseId === null) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    dimensionId,
    traitId,
    themeId,
    responseId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown): IdentiteProUserResponsesNode => {
  const record = asRecord(payload);

  const rawStatus = readString(record['status']).toLowerCase();
  const status: IdentiteProUserStatus =
    rawStatus === 'started' || rawStatus === 'completed' ? rawStatus : 'invited';

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawEntry) => normalizeAnswerEntry(rawEntry))
        .filter((entry): entry is IdentiteProAnswerEntry => entry !== null)
    : [];

  return {
    status,
    updatedAt: readString(record['updatedAt']),
    responses,
  };
};

const dedupeResponses = (responses: IdentiteProAnswerEntry[]): IdentiteProAnswerEntry[] => {
  const seenByQuestion = new Set<string>();
  const deduped: IdentiteProAnswerEntry[] = [];

  responses.forEach((response) => {
    const key = `${response.quizId}::${buildQuestionKey(response.dimensionId, response.traitId)}`;
    if (seenByQuestion.has(key)) {
      return;
    }

    seenByQuestion.add(key);
    deduped.push(response);
  });

  return deduped;
};

const buildQuestionKey = (dimensionId: number, traitId: number): string => `${dimensionId}::${traitId}`;

const parseQuestionKey = (
  questionKey: string,
  atlas: IdentiteProAtlas,
): IdentiteProPromptQuestion | null => {
  const [rawDimensionId, rawTraitId] = questionKey.split('::');
  const dimensionId = readNumber(rawDimensionId);
  const traitId = readNumber(rawTraitId);
  if (dimensionId === null || traitId === null) {
    return null;
  }

  const dimension = atlas.dimensionById.get(dimensionId);
  const trait = atlas.traitById.get(traitId);
  if (!dimension || !trait) {
    return null;
  }

  return { dimension, trait };
};

const buildAllQuestionKeys = (atlas: IdentiteProAtlas): string[] =>
  atlas.dimensionsIdentite.flatMap((dimension) =>
    atlas.traits.map((trait) => buildQuestionKey(dimension.id, trait.id)),
  );

const getAnsweredQuestionKeys = (responses: IdentiteProAnswerEntry[]): Set<string> => {
  const keys = new Set<string>();

  responses.forEach((response) => {
    if (response.quizId === IDENTITE_PRO_QUIZ_ID) {
      keys.add(buildQuestionKey(response.dimensionId, response.traitId));
    }
  });

  return keys;
};

const averageValues = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getDimensionKey = (dimension: IdentiteProDimension): string =>
  dimension.key.trim().toLowerCase();

const isIdentiteProDimensionKey = (dimensionKey: string): boolean =>
  dimensionKey === 'identite_de_soi' || dimensionKey === 'identite_percue';

const buildEmptyDimensionStats = (dimension: IdentiteProDimension): IdentiteProDimensionStats => ({
  dimensionId: dimension.id,
  key: dimension.key,
  label: dimension.label,
  responseCount: 0,
  averageValue: 0,
});

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
