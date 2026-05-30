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
  dimensionsIdentite: IdentiteProDimension[];
  themes: IdentiteProTheme[];
  reponses: IdentiteProResponse[];
  traits: IdentiteProTrait[];
  dimensionById: Map<number, IdentiteProDimension>;
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
    dimensionsIdentite,
    themes,
    reponses,
    traits,
    dimensionById: new Map(dimensionsIdentite.map((dimension) => [dimension.id, dimension])),
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
