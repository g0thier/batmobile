import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class PyramideBesoinsSession {
  private readonly database = inject(Database);

  private atlasPromise: Promise<PyramideBesoinsAtlas> | null = null;

  async loadAtlas(): Promise<PyramideBesoinsAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/pyramide-besoins.json')
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

  async getPromptForSession(sessionId: string, userId: string): Promise<PyramideBesoinsPromptState> {
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
        reponses: atlas.reponses,
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
      reponses: atlas.reponses,
      totalCount: atlas.affirmations.length,
      answeredCount: answeredIds.size,
      remainingCount: remainingAffirmations.length,
      isCompleted: false,
    };
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    answer: PyramideBesoinsAnswerInput,
  ): Promise<PyramideBesoinsSubmitAnswerResult> {
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

    const matchedReponse = atlas.reponses.find((reponse) => reponse.id === answer.reponseId);
    if (!matchedReponse) {
      throw new Error('Réponse introuvable.');
    }

    const matchedBesoin = atlas.besoins.find((besoin) => besoin.id === answer.besoinId);
    if (!matchedBesoin) {
      throw new Error('Besoin introuvable.');
    }

    if (matchedAffirmation.besoin !== answer.besoinId) {
      throw new Error("Le besoin associé à l'affirmation est invalide.");
    }

    const normalizedExistingResponses = dedupeResponses(currentNode.responses);
    const alreadyAnswered = normalizedExistingResponses.some(
      (response) => response.quizId === PYRAMIDE_BESOINS_QUIZ_ID && response.affirmationId === answer.affirmationId,
    );

    const nowIso = new Date().toISOString();
    const updatedResponses = alreadyAnswered
      ? normalizedExistingResponses
      : [
          ...normalizedExistingResponses,
          {
            quizId: PYRAMIDE_BESOINS_QUIZ_ID,
            affirmationId: answer.affirmationId,
            reponseId: answer.reponseId,
            besoinId: answer.besoinId,
            answeredAt: nowIso,
          },
        ];

    const answeredIds = getAnsweredAffirmationIds(updatedResponses);
    const isCompleted = answeredIds.size >= atlas.affirmations.length;
    const status: PyramideBesoinsUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: PyramideBesoinsUserResponsesNode = {
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
  ): Promise<PyramideBesoinsEligibleSession | null> {
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
  ): Promise<PyramideBesoinsUserResponsesNode> {
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

const PYRAMIDE_BESOINS_QUIZ_ID = 'pyramide-besoins';

type PyramideBesoinsUserStatus = 'invited' | 'started' | 'completed';

interface PyramideBesoinsBesoin {
  id: number;
  key: string;
  label: string;
}

export interface PyramideBesoinsReponse {
  id: number;
  valeur: number;
  label: string;
}

export interface PyramideBesoinsAffirmation {
  id: number;
  label: string;
  besoin: number;
}

export interface PyramideBesoinsAtlas {
  besoins: PyramideBesoinsBesoin[];
  reponses: PyramideBesoinsReponse[];
  affirmations: PyramideBesoinsAffirmation[];
}

export interface PyramideBesoinsAnswerInput {
  affirmationId: number;
  reponseId: number;
  besoinId: number;
}

export interface PyramideBesoinsAnswerEntry {
  quizId: string;
  affirmationId: number;
  reponseId: number;
  besoinId: number;
  answeredAt: string;
}

interface PyramideBesoinsUserResponsesNode {
  status: PyramideBesoinsUserStatus;
  updatedAt: string;
  responses: PyramideBesoinsAnswerEntry[];
}

export interface PyramideBesoinsPromptState {
  affirmation: PyramideBesoinsAffirmation | null;
  reponses: PyramideBesoinsReponse[];
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface PyramideBesoinsSubmitAnswerResult {
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

interface PyramideBesoinsEligibleSession {
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

const normalizeAtlas = (payload: unknown): PyramideBesoinsAtlas => {
  const record = asRecord(payload);

  const besoins = Array.isArray(record['besoins'])
    ? record['besoins']
        .map((rawBesoin) => {
          const besoinRecord = asRecord(rawBesoin);
          const id = readNumber(besoinRecord['id']);
          if (id === null) {
            return null;
          }

          return {
            id,
            key: readString(besoinRecord['key']),
            label: readString(besoinRecord['label']),
          } satisfies PyramideBesoinsBesoin;
        })
        .filter((besoin): besoin is PyramideBesoinsBesoin => besoin !== null)
    : [];

  const reponses = Array.isArray(record['reponses'])
    ? record['reponses']
        .map((rawReponse) => {
          const reponseRecord = asRecord(rawReponse);
          const id = readNumber(reponseRecord['id']);
          const valeur = readNumber(reponseRecord['valeur']);
          if (id === null || valeur === null) {
            return null;
          }

          return {
            id,
            valeur,
            label: readString(reponseRecord['label']),
          } satisfies PyramideBesoinsReponse;
        })
        .filter((reponse): reponse is PyramideBesoinsReponse => reponse !== null)
    : [];

  const affirmations = Array.isArray(record['affirmations'])
    ? record['affirmations']
        .map((rawAffirmation) => {
          const affirmationRecord = asRecord(rawAffirmation);
          const id = readNumber(affirmationRecord['id']);
          const besoin = readNumber(affirmationRecord['besoin']);
          if (id === null || besoin === null) {
            return null;
          }

          return {
            id,
            label: readString(affirmationRecord['label']),
            besoin,
          } satisfies PyramideBesoinsAffirmation;
        })
        .filter((affirmation): affirmation is PyramideBesoinsAffirmation => affirmation !== null)
    : [];

  return { besoins, reponses, affirmations };
};

const normalizeAnswerEntry = (payload: unknown): PyramideBesoinsAnswerEntry | null => {
  const record = asRecord(payload);
  const affirmationId = readNumber(record['affirmationId']);
  const reponseId = readNumber(record['reponseId']);
  const besoinId = readNumber(record['besoinId']);

  if (affirmationId === null || reponseId === null || besoinId === null) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    affirmationId,
    reponseId,
    besoinId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown): PyramideBesoinsUserResponsesNode => {
  const record = asRecord(payload);

  const rawStatus = readString(record['status']).toLowerCase();
  const status: PyramideBesoinsUserStatus =
    rawStatus === 'started' || rawStatus === 'completed' ? rawStatus : 'invited';

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawEntry) => normalizeAnswerEntry(rawEntry))
        .filter((entry): entry is PyramideBesoinsAnswerEntry => entry !== null)
    : [];

  return {
    status,
    updatedAt: readString(record['updatedAt']),
    responses,
  };
};

const dedupeResponses = (
  responses: PyramideBesoinsAnswerEntry[],
): PyramideBesoinsAnswerEntry[] => {
  const seenByQuizAndAffirmation = new Set<string>();
  const deduped: PyramideBesoinsAnswerEntry[] = [];

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

const getAnsweredAffirmationIds = (
  responses: PyramideBesoinsAnswerEntry[],
): Set<number> => {
  const ids = new Set<number>();

  responses.forEach((response) => {
    if (response.quizId === PYRAMIDE_BESOINS_QUIZ_ID) {
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
