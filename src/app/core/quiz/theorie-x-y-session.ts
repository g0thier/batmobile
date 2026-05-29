import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class TheorieXYSession {
  private readonly database = inject(Database);

  private atlasPromise: Promise<TheorieXYAtlas> | null = null;

  async loadAtlas(): Promise<TheorieXYAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/theorie-x-y.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossible de charger les affirmations du quiz.');
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
  ): Promise<TheorieXYPromptState> {
    const [atlas, responsesByUser] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(sessionId, userId),
    ]);

    const answeredIds = getAnsweredAffirmationIds(responsesByUser.responses);
    const remainingAffirmations = atlas.affirmations.filter(
      (affirmation) => !answeredIds.has(affirmation.id),
    );

    if (remainingAffirmations.length === 0) {
      return {
        affirmation: null,
        totalCount: atlas.affirmations.length,
        answeredCount: answeredIds.size,
        remainingCount: 0,
        isCompleted: true,
      };
    }

    const randomIndex = Math.floor(Math.random() * remainingAffirmations.length);
    const randomAffirmation = remainingAffirmations[randomIndex] ?? null;

    return {
      affirmation: randomAffirmation,
      totalCount: atlas.affirmations.length,
      answeredCount: answeredIds.size,
      remainingCount: remainingAffirmations.length,
      isCompleted: false,
    };
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    answer: TheorieXYAnswerInput,
  ): Promise<TheorieXYSubmitAnswerResult> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, currentNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const matchedAffirmation = atlas.affirmations.find(
      (affirmation) => affirmation.id === answer.affirmationId,
    );
    if (!matchedAffirmation) {
      throw new Error('Affirmation introuvable.');
    }

    const normalizedExistingResponses = dedupeResponses(currentNode.responses);
    const alreadyAnswered = normalizedExistingResponses.some(
      (response) => response.quizId === THEORIE_XY_QUIZ_ID && response.affirmationId === answer.affirmationId,
    );

    const nowIso = new Date().toISOString();
    const updatedResponses = alreadyAnswered
      ? normalizedExistingResponses
      : [
          ...normalizedExistingResponses,
          {
            quizId: THEORIE_XY_QUIZ_ID,
            affirmationId: answer.affirmationId,
            responseId: answer.responseId,
            themeId: answer.themeId,
            answeredAt: nowIso,
          },
        ];

    const answeredIds = getAnsweredAffirmationIds(updatedResponses);
    const isCompleted = answeredIds.size >= atlas.affirmations.length;
    const status: TheorieXYUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: TheorieXYUserResponsesNode = {
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
      remainingCount: Math.max(atlas.affirmations.length - answeredIds.size, 0),
      isCompleted,
    };
  }

  async pickRandomNextEligibleSession(
    userId: string,
    currentSessionId: string,
  ): Promise<TheorieXYEligibleSession | null> {
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
  ): Promise<TheorieXYUserResponsesNode> {
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

const THEORIE_XY_QUIZ_ID = 'theorie-x-y';

type TheorieXYUserStatus = 'invited' | 'started' | 'completed';

interface TheorieXYTheme {
  id: number;
  label: string;
}

interface TheorieXYAnswer {
  id: number;
  valeur: number;
  label: string;
}

export interface TheorieXYAffirmation {
  id: number;
  theme: number;
  x: string;
  y: string;
}

export interface TheorieXYAtlas {
  themes: TheorieXYTheme[];
  reponses: TheorieXYAnswer[];
  affirmations: TheorieXYAffirmation[];
}

export interface TheorieXYAnswerInput {
  affirmationId: number;
  themeId: number;
  responseId: number;
}

export interface TheorieXYAnswerEntry {
  quizId: string;
  affirmationId: number;
  responseId: number;
  themeId: number;
  answeredAt: string;
}

interface TheorieXYUserResponsesNode {
  status: TheorieXYUserStatus;
  updatedAt: string;
  responses: TheorieXYAnswerEntry[];
}

export interface TheorieXYPromptState {
  affirmation: TheorieXYAffirmation | null;
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface TheorieXYSubmitAnswerResult {
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

interface TheorieXYEligibleSession {
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

const normalizeAtlas = (payload: unknown): TheorieXYAtlas => {
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
          } satisfies TheorieXYTheme;
        })
        .filter((theme): theme is TheorieXYTheme => theme !== null)
    : [];

  const reponses = Array.isArray(record['reponses'])
    ? record['reponses']
        .map((rawAnswer) => {
          const answerRecord = asRecord(rawAnswer);
          const id = readNumber(answerRecord['id']);
          const valeur = readNumber(answerRecord['valeur']);
          if (id === null || valeur === null) {
            return null;
          }

          return {
            id,
            valeur,
            label: readString(answerRecord['label']),
          } satisfies TheorieXYAnswer;
        })
        .filter((answer): answer is TheorieXYAnswer => answer !== null)
    : [];

  const affirmations = Array.isArray(record['affirmations'])
    ? record['affirmations']
        .map((rawAffirmation) => {
          const affirmationRecord = asRecord(rawAffirmation);
          const id = readNumber(affirmationRecord['id']);
          const theme = readNumber(affirmationRecord['theme']);
          if (id === null || theme === null) {
            return null;
          }

          return {
            id,
            theme,
            x: readString(affirmationRecord['x']),
            y: readString(affirmationRecord['y']),
          } satisfies TheorieXYAffirmation;
        })
        .filter((affirmation): affirmation is TheorieXYAffirmation => affirmation !== null)
    : [];

  return { themes, reponses, affirmations };
};

const normalizeAnswerEntry = (payload: unknown): TheorieXYAnswerEntry | null => {
  const record = asRecord(payload);
  const affirmationId = readNumber(record['affirmationId']);
  const responseId = readNumber(record['responseId']);
  const themeId = readNumber(record['themeId']);

  if (affirmationId === null || responseId === null || themeId === null) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    affirmationId,
    responseId,
    themeId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown): TheorieXYUserResponsesNode => {
  const record = asRecord(payload);

  const rawStatus = readString(record['status']).toLowerCase();
  const status: TheorieXYUserStatus =
    rawStatus === 'started' || rawStatus === 'completed' ? rawStatus : 'invited';

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawEntry) => normalizeAnswerEntry(rawEntry))
        .filter((entry): entry is TheorieXYAnswerEntry => entry !== null)
    : [];

  return {
    status,
    updatedAt: readString(record['updatedAt']),
    responses,
  };
};

const dedupeResponses = (responses: TheorieXYAnswerEntry[]): TheorieXYAnswerEntry[] => {
  const seenByQuizAndAffirmation = new Set<string>();
  const deduped: TheorieXYAnswerEntry[] = [];

  responses.forEach((response) => {
    const key = `${response.quizId}::${response.affirmationId}`;
    if (seenByQuizAndAffirmation.has(key)) {
      return;
    }

    seenByQuizAndAffirmation.add(key);
    deduped.push(response);
  });

  return deduped;
};

const getAnsweredAffirmationIds = (responses: TheorieXYAnswerEntry[]): Set<number> => {
  const ids = new Set<number>();

  responses.forEach((response) => {
    if (response.quizId === THEORIE_XY_QUIZ_ID) {
      ids.add(response.affirmationId);
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
