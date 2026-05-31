import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class BesoinsAcquisSession {
  private readonly database = inject(Database);

  private atlasPromise: Promise<BesoinsAcquisAtlas> | null = null;

  async loadAtlas(): Promise<BesoinsAcquisAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/besoins-acquis.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossible de charger les questions du quiz.');
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

  async getPromptForSession(sessionId: string, userId: string): Promise<BesoinsAcquisPromptState> {
    const [atlas, responsesByUser] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(sessionId, userId),
    ]);

    const answeredIds = getAnsweredQuestionIds(responsesByUser.responses);
    const remainingQuestions = atlas.questions.filter((question) => !answeredIds.has(question.id));

    if (remainingQuestions.length === 0) {
      return {
        question: null,
        reponses: atlas.reponses,
        totalCount: atlas.questions.length,
        answeredCount: answeredIds.size,
        remainingCount: 0,
        isCompleted: true,
      };
    }

    const randomIndex = Math.floor(Math.random() * remainingQuestions.length);
    const randomQuestion = remainingQuestions[randomIndex] ?? null;

    return {
      question: randomQuestion,
      reponses: atlas.reponses,
      totalCount: atlas.questions.length,
      answeredCount: answeredIds.size,
      remainingCount: remainingQuestions.length,
      isCompleted: false,
    };
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    answer: BesoinsAcquisAnswerInput,
  ): Promise<BesoinsAcquisSubmitAnswerResult> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, currentNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const matchedQuestion = atlas.questions.find((question) => question.id === answer.questionId);
    if (!matchedQuestion) {
      throw new Error('Question introuvable.');
    }

    const matchedAnswer = atlas.reponses.find((reponse) => reponse.id === answer.reponseId);
    if (!matchedAnswer) {
      throw new Error('Réponse introuvable.');
    }

    const matchedBesoin = atlas.besoins.find((besoin) => besoin.id === answer.besoinId);
    if (!matchedBesoin) {
      throw new Error('Besoin introuvable.');
    }

    if (matchedQuestion.besoin !== answer.besoinId) {
      throw new Error('Le besoin associé à la question est invalide.');
    }

    const normalizedExistingResponses = dedupeResponses(currentNode.responses);
    const alreadyAnswered = normalizedExistingResponses.some(
      (response) => response.quizId === BESOINS_ACQUIS_QUIZ_ID && response.questionId === answer.questionId,
    );

    const nowIso = new Date().toISOString();
    const updatedResponses = alreadyAnswered
      ? normalizedExistingResponses
      : [
          ...normalizedExistingResponses,
          {
            quizId: BESOINS_ACQUIS_QUIZ_ID,
            questionId: answer.questionId,
            reponseId: answer.reponseId,
            besoinId: answer.besoinId,
            answeredAt: nowIso,
          },
        ];

    const answeredIds = getAnsweredQuestionIds(updatedResponses);
    const isCompleted = answeredIds.size >= atlas.questions.length;
    const status: BesoinsAcquisUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: BesoinsAcquisUserResponsesNode = {
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
      remainingCount: Math.max(atlas.questions.length - answeredIds.size, 0),
      isCompleted,
    };
  }

  async getSessionStats(sessionId: string, userId: string): Promise<BesoinsAcquisSessionStats> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, userNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const questionById = new Map(atlas.questions.map((question) => [question.id, question]));
    const responseById = new Map(atlas.reponses.map((response) => [response.id, response]));
    const questionCountByBesoinId = new Map<number, number>();

    atlas.questions.forEach((question) => {
      const currentCount = questionCountByBesoinId.get(question.besoin) ?? 0;
      questionCountByBesoinId.set(question.besoin, currentCount + 1);
    });

    const deltaByBesoinId = new Map<number, number>();
    const answeredQuestionIdsByBesoinId = new Map<number, Set<number>>();
    const normalizedResponses = dedupeResponses(userNode.responses).filter(
      (response) => response.quizId === BESOINS_ACQUIS_QUIZ_ID,
    );

    normalizedResponses.forEach((responseEntry) => {
      const matchedQuestion = questionById.get(responseEntry.questionId);
      const matchedResponse = responseById.get(responseEntry.reponseId);

      if (!matchedQuestion || !matchedResponse) {
        return;
      }

      if (matchedQuestion.besoin !== responseEntry.besoinId) {
        return;
      }

      const questionCount = questionCountByBesoinId.get(responseEntry.besoinId) ?? 0;
      if (questionCount <= 0) {
        return;
      }

      const delta = matchedResponse.valeur * (25 / questionCount);
      const currentDelta = deltaByBesoinId.get(responseEntry.besoinId) ?? 0;
      deltaByBesoinId.set(responseEntry.besoinId, currentDelta + delta);

      const answeredSet = answeredQuestionIdsByBesoinId.get(responseEntry.besoinId) ?? new Set<number>();
      answeredSet.add(responseEntry.questionId);
      answeredQuestionIdsByBesoinId.set(responseEntry.besoinId, answeredSet);
    });

    const dimensions = atlas.besoins.map((besoin) => {
      const questionCount = questionCountByBesoinId.get(besoin.id) ?? 0;
      const answeredSet = answeredQuestionIdsByBesoinId.get(besoin.id);
      const answeredCount = answeredSet?.size ?? 0;
      const delta = deltaByBesoinId.get(besoin.id) ?? 0;
      const score = clamp(50 + delta, 0, 100);

      return {
        besoinId: besoin.id,
        key: besoin.key,
        label: besoin.label,
        questionCount,
        answeredCount,
        score: Number(score.toFixed(2)),
      } satisfies BesoinsAcquisDimensionScore;
    });

    const validAnsweredQuestionIds = new Set<number>();
    dimensions.forEach((dimension) => {
      const answeredSet = answeredQuestionIdsByBesoinId.get(dimension.besoinId);
      answeredSet?.forEach((id) => {
        validAnsweredQuestionIds.add(id);
      });
    });

    const answeredCount = validAnsweredQuestionIds.size;
    const totalCount = atlas.questions.length;

    return {
      title: atlas.titre,
      labels: dimensions.map((dimension) => dimension.key),
      scores: dimensions.map((dimension) => dimension.score),
      dimensions,
      answeredCount,
      totalCount,
      remainingCount: Math.max(totalCount - answeredCount, 0),
      isCompleted: answeredCount >= totalCount,
      updatedAt: userNode.updatedAt,
    };
  }

  async pickRandomNextEligibleSession(
    userId: string,
    currentSessionId: string,
  ): Promise<BesoinsAcquisEligibleSession | null> {
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
  ): Promise<BesoinsAcquisUserResponsesNode> {
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

const BESOINS_ACQUIS_QUIZ_ID = 'besoins-acquis';

type BesoinsAcquisUserStatus = 'invited' | 'started' | 'completed';

interface BesoinsAcquisBesoin {
  id: number;
  key: string;
  label: string;
}

export interface BesoinsAcquisReponse {
  id: number;
  valeur: number;
  label: string;
}

export interface BesoinsAcquisQuestion {
  id: number;
  label: string;
  besoin: number;
}

export interface BesoinsAcquisAtlas {
  titre: string;
  besoins: BesoinsAcquisBesoin[];
  reponses: BesoinsAcquisReponse[];
  questions: BesoinsAcquisQuestion[];
}

export interface BesoinsAcquisAnswerInput {
  questionId: number;
  reponseId: number;
  besoinId: number;
}

export interface BesoinsAcquisAnswerEntry {
  quizId: string;
  questionId: number;
  reponseId: number;
  besoinId: number;
  answeredAt: string;
}

interface BesoinsAcquisUserResponsesNode {
  status: BesoinsAcquisUserStatus;
  updatedAt: string;
  responses: BesoinsAcquisAnswerEntry[];
}

export interface BesoinsAcquisPromptState {
  question: BesoinsAcquisQuestion | null;
  reponses: BesoinsAcquisReponse[];
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface BesoinsAcquisSubmitAnswerResult {
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface BesoinsAcquisDimensionScore {
  besoinId: number;
  key: string;
  label: string;
  questionCount: number;
  answeredCount: number;
  score: number;
}

export interface BesoinsAcquisSessionStats {
  title: string;
  labels: string[];
  scores: number[];
  dimensions: BesoinsAcquisDimensionScore[];
  answeredCount: number;
  totalCount: number;
  remainingCount: number;
  isCompleted: boolean;
  updatedAt: string;
}

interface BesoinsAcquisEligibleSession {
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

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const normalizeAtlas = (payload: unknown): BesoinsAcquisAtlas => {
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
          } satisfies BesoinsAcquisBesoin;
        })
        .filter((besoin): besoin is BesoinsAcquisBesoin => besoin !== null)
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
          } satisfies BesoinsAcquisReponse;
        })
        .filter((reponse): reponse is BesoinsAcquisReponse => reponse !== null)
    : [];

  const questions = Array.isArray(record['questions'])
    ? record['questions']
        .map((rawQuestion) => {
          const questionRecord = asRecord(rawQuestion);
          const id = readNumber(questionRecord['id']);
          const besoin = readNumber(questionRecord['besoin']);
          if (id === null || besoin === null) {
            return null;
          }

          return {
            id,
            label: readString(questionRecord['label']),
            besoin,
          } satisfies BesoinsAcquisQuestion;
        })
        .filter((question): question is BesoinsAcquisQuestion => question !== null)
    : [];

  return {
    titre: readString(record['titre']),
    besoins,
    reponses,
    questions,
  };
};

const normalizeAnswerEntry = (payload: unknown): BesoinsAcquisAnswerEntry | null => {
  const record = asRecord(payload);
  const questionId = readNumber(record['questionId']);
  const reponseId = readNumber(record['reponseId']);
  const besoinId = readNumber(record['besoinId']);

  if (questionId === null || reponseId === null || besoinId === null) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    questionId,
    reponseId,
    besoinId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown): BesoinsAcquisUserResponsesNode => {
  const record = asRecord(payload);

  const rawStatus = readString(record['status']).toLowerCase();
  const status: BesoinsAcquisUserStatus =
    rawStatus === 'started' || rawStatus === 'completed' ? rawStatus : 'invited';

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawEntry) => normalizeAnswerEntry(rawEntry))
        .filter((entry): entry is BesoinsAcquisAnswerEntry => entry !== null)
    : [];

  return {
    status,
    updatedAt: readString(record['updatedAt']),
    responses,
  };
};

const dedupeResponses = (responses: BesoinsAcquisAnswerEntry[]): BesoinsAcquisAnswerEntry[] => {
  const seenByQuizAndQuestion = new Set<string>();
  const deduped: BesoinsAcquisAnswerEntry[] = [];

  responses.forEach((response) => {
    const key = `${response.quizId}::${response.questionId}`;
    if (seenByQuizAndQuestion.has(key)) {
      return;
    }

    seenByQuizAndQuestion.add(key);
    deduped.push(response);
  });

  return deduped;
};

const getAnsweredQuestionIds = (responses: BesoinsAcquisAnswerEntry[]): Set<number> => {
  const ids = new Set<number>();

  responses.forEach((response) => {
    if (response.quizId === BESOINS_ACQUIS_QUIZ_ID) {
      ids.add(response.questionId);
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
