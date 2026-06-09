import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class EquiteSession {
  private readonly database = inject(Database);

  private atlasPromise: Promise<EquiteAtlas> | null = null;

  async loadAtlas(): Promise<EquiteAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/equite.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Impossible de charger les oppositions du quiz.");
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

  async getPromptForSession(sessionId: string, userId: string): Promise<EquitePromptState> {
    const [atlas, responsesByUser] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(sessionId, userId),
    ]);

    const answeredIds = getAnsweredOppositionIds(responsesByUser.responses);
    const remainingOppositions = atlas.oppositions.filter(
      (opposition) => !answeredIds.has(opposition.id),
    );

    if (remainingOppositions.length === 0) {
      return {
        opposition: null,
        totalCount: atlas.oppositions.length,
        answeredCount: answeredIds.size,
        remainingCount: 0,
        isCompleted: true,
      };
    }

    const randomIndex = Math.floor(Math.random() * remainingOppositions.length);
    const randomOpposition = remainingOppositions[randomIndex] ?? null;

    return {
      opposition: randomOpposition,
      totalCount: atlas.oppositions.length,
      answeredCount: answeredIds.size,
      remainingCount: remainingOppositions.length,
      isCompleted: false,
    };
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    answer: EquiteAnswerInput,
  ): Promise<EquiteSubmitAnswerResult> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, currentNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const matchedOpposition = atlas.oppositions.find((opposition) => opposition.id === answer.oppositionId);
    if (!matchedOpposition) {
      throw new Error('Opposition introuvable.');
    }

    const matchedResponse = atlas.reponses.find((response) => response.id === answer.responseId);
    if (!matchedResponse) {
      throw new Error('Réponse introuvable.');
    }

    const normalizedExistingResponses = dedupeResponses(currentNode.responses);
    const alreadyAnswered = normalizedExistingResponses.some(
      (response) => response.quizId === EQUITE_QUIZ_ID && response.oppositionId === answer.oppositionId,
    );

    const nowIso = new Date().toISOString();
    const updatedResponses = alreadyAnswered
      ? normalizedExistingResponses
      : [
          ...normalizedExistingResponses,
          {
            quizId: EQUITE_QUIZ_ID,
            oppositionId: answer.oppositionId,
            responseId: answer.responseId,
            themeId: answer.themeId,
            answeredAt: nowIso,
          },
        ];

    const answeredIds = getAnsweredOppositionIds(updatedResponses);
    const isCompleted = answeredIds.size >= atlas.oppositions.length;
    const status: EquiteUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: EquiteUserResponsesNode = {
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
      answeredCount: answeredIds.size,
      remainingCount: Math.max(atlas.oppositions.length - answeredIds.size, 0),
      isCompleted,
    };
  }

  async getSessionStats(sessionId: string, userId: string): Promise<EquiteSessionStats> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, userNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const responseById = new Map(atlas.reponses.map((response) => [response.id, response]));
    const themeById = new Map(atlas.themes.map((theme) => [theme.id, theme]));
    const oppositionById = new Map(atlas.oppositions.map((opposition) => [opposition.id, opposition]));

    const responsesByThemeId = new Map<number, number[]>();
    const answeredOppositionIds = new Set<number>();

    dedupeResponses(userNode.responses)
      .filter((response) => response.quizId === EQUITE_QUIZ_ID)
      .forEach((responseEntry) => {
        const matchedOpposition = oppositionById.get(responseEntry.oppositionId);
        const matchedResponse = responseById.get(responseEntry.responseId);
        const matchedTheme = themeById.get(responseEntry.themeId);

        if (!matchedOpposition || !matchedResponse || !matchedTheme) {
          return;
        }

        if (matchedOpposition.theme !== responseEntry.themeId) {
          return;
        }

        answeredOppositionIds.add(matchedOpposition.id);

        const currentValues = responsesByThemeId.get(matchedTheme.id) ?? [];
        currentValues.push(matchedResponse.valeur);
        responsesByThemeId.set(matchedTheme.id, currentValues);
      });

    return {
      title: atlas.titre || atlas.nom || 'Équité',
      totalCount: atlas.oppositions.length,
      answeredCount: answeredOppositionIds.size,
      themes: atlas.themes.map((theme) => {
        const values = responsesByThemeId.get(theme.id) ?? [];
        const responseCount = values.length;
        const minValue = responseCount > 0 ? Math.min(...values) : 0;
        const maxValue = responseCount > 0 ? Math.max(...values) : 0;
        const averageValue =
          responseCount > 0
            ? values.reduce((sum, value) => sum + value, 0) / responseCount
            : 0;

        return {
          themeId: theme.id,
          label: theme.label,
          responseCount,
          minValue,
          maxValue,
          averageValue,
          minPct: responseValueToPercent(minValue),
          maxPct: responseValueToPercent(maxValue),
          averagePct: responseValueToPercent(averageValue),
        };
      }),
    };
  }

  async pickRandomNextEligibleSession(
    userId: string,
    currentSessionId: string,
  ): Promise<EquiteEligibleSession | null> {
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
  ): Promise<EquiteUserResponsesNode> {
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

const EQUITE_QUIZ_ID = 'equite';

type EquiteUserStatus = 'invited' | 'started' | 'completed';

interface EquiteTheme {
  id: number;
  label: string;
}

interface EquiteResponse {
  id: number;
  valeur: number;
  label: string;
}

interface EquiteFacet {
  label: string;
  image: string;
}

export interface EquiteOpposition {
  id: number;
  theme: number;
  contribution: EquiteFacet;
  retribution: EquiteFacet;
}

export interface EquiteAtlas {
  nom: string;
  titre: string;
  themes: EquiteTheme[];
  reponses: EquiteResponse[];
  oppositions: EquiteOpposition[];
}

export interface EquiteThemeStats {
  themeId: number;
  label: string;
  responseCount: number;
  minValue: number;
  maxValue: number;
  averageValue: number;
  minPct: number;
  maxPct: number;
  averagePct: number;
}

export interface EquiteSessionStats {
  title: string;
  totalCount: number;
  answeredCount: number;
  themes: EquiteThemeStats[];
}

export interface EquiteAnswerInput {
  oppositionId: number;
  themeId: number;
  responseId: number;
}

export interface EquiteAnswerEntry {
  quizId: string;
  oppositionId: number;
  responseId: number;
  themeId: number;
  answeredAt: string;
}

interface EquiteUserResponsesNode {
  status: EquiteUserStatus;
  updatedAt: string;
  responses: EquiteAnswerEntry[];
}

export interface EquitePromptState {
  opposition: EquiteOpposition | null;
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface EquiteSubmitAnswerResult {
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

interface EquiteEligibleSession {
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

const normalizeFacet = (value: unknown): EquiteFacet => {
  const record = asRecord(value);
  return {
    label: readString(record['label']),
    image: readString(record['image']),
  };
};

const normalizeAtlas = (payload: unknown): EquiteAtlas => {
  const record = asRecord(payload);

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
          } satisfies EquiteTheme;
        })
        .filter((theme): theme is EquiteTheme => theme !== null)
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
          } satisfies EquiteResponse;
        })
        .filter((response): response is EquiteResponse => response !== null)
    : [];

  const oppositions = Array.isArray(record['oppositions'])
    ? record['oppositions']
        .map((rawOpposition) => {
          const oppositionRecord = asRecord(rawOpposition);
          const id = readNumber(oppositionRecord['id']);
          const theme = readNumber(oppositionRecord['theme']);
          if (id === null || theme === null) {
            return null;
          }

          return {
            id,
            theme,
            contribution: normalizeFacet(oppositionRecord['contribution']),
            retribution: normalizeFacet(oppositionRecord['retribution']),
          } satisfies EquiteOpposition;
        })
        .filter((opposition): opposition is EquiteOpposition => opposition !== null)
    : [];

  return {
    nom: readString(record['nom']),
    titre: readString(record['titre']),
    themes,
    reponses,
    oppositions,
  };
};

const normalizeAnswerEntry = (value: unknown): EquiteAnswerEntry | null => {
  const record = asRecord(value);
  const oppositionId = readNumber(record['oppositionId']);
  const responseId = readNumber(record['responseId']);
  const themeId = readNumber(record['themeId']);

  if (oppositionId === null || responseId === null || themeId === null) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    oppositionId,
    responseId,
    themeId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown): EquiteUserResponsesNode => {
  const record = asRecord(payload);

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawResponse) => normalizeAnswerEntry(rawResponse))
        .filter((response): response is EquiteAnswerEntry => response !== null)
    : [];

  const dedupedResponses = dedupeResponses(responses);
  const normalizedStatus = readString(record['status']).toLowerCase();

  return {
    status:
      normalizedStatus === 'completed' || normalizedStatus === 'started' || normalizedStatus === 'invited'
        ? (normalizedStatus as EquiteUserStatus)
        : dedupedResponses.length > 0
          ? 'started'
          : 'invited',
    updatedAt: readString(record['updatedAt']),
    responses: dedupedResponses,
  };
};

const dedupeResponses = (responses: EquiteAnswerEntry[]): EquiteAnswerEntry[] => {
  const dedupMap = new Map<string, EquiteAnswerEntry>();

  responses.forEach((response) => {
    const key = `${response.quizId}::${response.oppositionId}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, response);
    }
  });

  return Array.from(dedupMap.values());
};

const getAnsweredOppositionIds = (responses: EquiteAnswerEntry[]): Set<number> => {
  const ids = new Set<number>();
  responses.forEach((response) => {
    if (response.quizId === EQUITE_QUIZ_ID) {
      ids.add(response.oppositionId);
    }
  });
  return ids;
};

const normalizeUserSession = (sessionKey: string, payload: unknown): UserSessionSummary => {
  const record = asRecord(payload);
  return {
    sessionId: readString(record['sessionId']) || readString(sessionKey),
    quizId: readString(record['quizId']).toLowerCase(),
    responseDeadline: readString(record['responseDeadline']),
  };
};

const isExpired = (deadlineIso: string): boolean => {
  const timestamp = new Date(deadlineIso).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  return timestamp < Date.now();
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const responseValueToPercent = (value: number): number => {
  const normalizedValue = clamp(value, -5, 5);
  return clamp(((normalizedValue + 5) / 10) * 100, 0, 100);
};
