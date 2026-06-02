import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { get, ref, set } from 'firebase/database';
import { QuizCatalogService } from '../quiz/quiz-catalog.service';
import {
  buildSessionSummaryFromAttentes,
  SuccessProgressService,
} from '../success/success-progress';

@Injectable({
  providedIn: 'root',
})
export class AttentesSession {
  private readonly database = inject(Database);
  private readonly quizCatalogService = inject(QuizCatalogService);
  private readonly successProgressService = inject(SuccessProgressService);

  private atlasPromise: Promise<AttentesAtlas> | null = null;

  async loadAtlas(): Promise<AttentesAtlas> {
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.atlasPromise = fetch('/quiz/atlas/attentes.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossible de charger les données du quiz.');
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

  async getPromptForSession(sessionId: string, userId: string): Promise<AttentesPromptState> {
    const [atlas, responsesByUser] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(sessionId, userId),
    ]);

    const allQuestionKeys = new Set(buildAllQuestionKeys(atlas));
    const answeredKeys = getAnsweredQuestionKeys(responsesByUser.responses);
    const remainingQuestionKeys = [...allQuestionKeys].filter((key) => !answeredKeys.has(key));

    const remainingQuestions = remainingQuestionKeys
      .map((key) => parseQuestionKey(key, atlas))
      .filter((question): question is AttentesPromptQuestion => question !== null);

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
    answer: AttentesAnswerInput,
  ): Promise<AttentesSubmitAnswerResult> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, currentNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const matchedFacteur = atlas.facteurById.get(answer.facteurId);
    if (!matchedFacteur) {
      throw new Error('Facteur introuvable.');
    }

    const matchedAffirmation = atlas.affirmationById.get(answer.affirmationId);
    if (!matchedAffirmation) {
      throw new Error('Affirmation introuvable.');
    }

    const matchedAttente = atlas.attenteById.get(answer.attenteId);
    if (!matchedAttente) {
      throw new Error('Attente introuvable.');
    }

    if (matchedAffirmation.attente !== answer.attenteId) {
      throw new Error("L'attente associée à l'affirmation est invalide.");
    }

    const matchedResponse = matchedFacteur.reponses.find((response) => response.id === answer.reponseId);
    if (!matchedResponse) {
      throw new Error('Réponse introuvable pour ce facteur.');
    }

    const normalizedExistingResponses = dedupeResponses(currentNode.responses);
    const questionKey = buildQuestionKey(answer.facteurId, answer.affirmationId);
    const alreadyAnswered = normalizedExistingResponses.some(
      (response) =>
        response.quizId === ATTENTES_QUIZ_ID &&
        buildQuestionKey(response.facteurId, response.affirmationId) === questionKey,
    );

    const nowIso = new Date().toISOString();
    const updatedResponses = alreadyAnswered
      ? normalizedExistingResponses
      : [
          ...normalizedExistingResponses,
          {
            quizId: ATTENTES_QUIZ_ID,
            facteurId: answer.facteurId,
            affirmationId: answer.affirmationId,
            attenteId: answer.attenteId,
            reponseId: answer.reponseId,
            answeredAt: nowIso,
          },
        ];

    const totalCount = buildAllQuestionKeys(atlas).length;
    const answeredKeys = getAnsweredQuestionKeys(updatedResponses);
    const answeredCount = Math.min(answeredKeys.size, totalCount);
    const isCompleted = answeredCount >= totalCount;
    const status: AttentesUserStatus = isCompleted ? 'completed' : 'started';

    const nodeToWrite: AttentesUserResponsesNode = {
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

    if (!alreadyAnswered) {
      const sessionStats = await this.getSessionStats(normalizedSessionId, normalizedUserId);
      await this.successProgressService.recordSessionSummary(
        buildSessionSummaryFromAttentes(
          {
            sessionId: normalizedSessionId,
            quizId: ATTENTES_QUIZ_ID,
          },
          sessionStats,
          nowIso,
          this.quizCatalogService,
        ),
      );
    }

    return {
      answeredCount,
      remainingCount: Math.max(totalCount - answeredCount, 0),
      isCompleted,
    };
  }

  async getSessionStats(sessionId: string, userId: string): Promise<AttentesSessionStats> {
    const normalizedSessionId = readString(sessionId);
    const normalizedUserId = readString(userId);

    if (!normalizedSessionId || !normalizedUserId) {
      throw new Error('Session ou utilisateur introuvable.');
    }

    const [atlas, userNode] = await Promise.all([
      this.loadAtlas(),
      this.readUserResponsesNode(normalizedSessionId, normalizedUserId),
    ]);

    const affirmationCountByAttenteId = new Map<number, number>();
    atlas.affirmations.forEach((affirmation) => {
      const currentCount = affirmationCountByAttenteId.get(affirmation.attente) ?? 0;
      affirmationCountByAttenteId.set(affirmation.attente, currentCount + 1);
    });

    const maxResponseValueByFacteurId = new Map<number, number>();
    atlas.facteurs.forEach((facteur) => {
      const maxValue = facteur.reponses.reduce((currentMax, response) => {
        return Math.max(currentMax, response.valeur);
      }, 0);
      maxResponseValueByFacteurId.set(facteur.id, Math.max(maxValue, 0));
    });

    const pointsByCell = new Map<string, number>();
    const answeredKeysByCell = new Map<string, Set<string>>();
    const validAnsweredQuestionKeys = new Set<string>();

    const normalizedResponses = dedupeResponses(userNode.responses).filter(
      (response) => response.quizId === ATTENTES_QUIZ_ID,
    );

    normalizedResponses.forEach((responseEntry) => {
      const matchedFacteur = atlas.facteurById.get(responseEntry.facteurId);
      const matchedAffirmation = atlas.affirmationById.get(responseEntry.affirmationId);
      const matchedAttente = atlas.attenteById.get(responseEntry.attenteId);

      if (!matchedFacteur || !matchedAffirmation || !matchedAttente) {
        return;
      }

      if (matchedAffirmation.attente !== responseEntry.attenteId) {
        return;
      }

      const matchedResponse = matchedFacteur.reponses.find(
        (response) => response.id === responseEntry.reponseId,
      );
      if (!matchedResponse) {
        return;
      }

      const cellKey = buildQuestionKey(responseEntry.attenteId, responseEntry.facteurId);
      const currentPoints = pointsByCell.get(cellKey) ?? 0;
      pointsByCell.set(cellKey, currentPoints + matchedResponse.valeur);

      const questionKey = buildQuestionKey(responseEntry.facteurId, responseEntry.affirmationId);
      validAnsweredQuestionKeys.add(questionKey);

      const answeredSet = answeredKeysByCell.get(cellKey) ?? new Set<string>();
      answeredSet.add(questionKey);
      answeredKeysByCell.set(cellKey, answeredSet);
    });

    const attentes = atlas.attentes.map((attente) => {
      const labels = atlas.facteurs.map((facteur) => facteur.titre || facteur.facteur);
      const dimensions = atlas.facteurs.map((facteur) => {
        const questionCount = affirmationCountByAttenteId.get(attente.id) ?? 0;
        const maxResponseValue = maxResponseValueByFacteurId.get(facteur.id) ?? 0;
        const maxPoints = questionCount * maxResponseValue;
        const cellKey = buildQuestionKey(attente.id, facteur.id);
        const points = pointsByCell.get(cellKey) ?? 0;
        const answeredCount = answeredKeysByCell.get(cellKey)?.size ?? 0;
        const score = maxPoints > 0 ? clamp((points / maxPoints) * 100, 0, 100) : 0;

        return {
          attenteId: attente.id,
          facteurId: facteur.id,
          key: facteur.facteur,
          label: facteur.titre || facteur.facteur,
          labelDetail: facteur.label,
          questionCount,
          answeredCount,
          points: Number(points.toFixed(2)),
          maxPoints: Number(maxPoints.toFixed(2)),
          score: Number(score.toFixed(2)),
        } satisfies AttentesDimensionScore;
      });

      return {
        attenteId: attente.id,
        title: attente.label,
        labels,
        scores: dimensions.map((dimension) => dimension.score),
        dimensions,
      } satisfies AttentesAttenteStats;
    });

    const answeredCount = validAnsweredQuestionKeys.size;
    const totalCount = buildAllQuestionKeys(atlas).length;

    return {
      title: atlas.titre || 'Attentes',
      attentes,
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
  ): Promise<AttentesEligibleSession | null> {
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
  ): Promise<AttentesUserResponsesNode> {
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

const ATTENTES_QUIZ_ID = 'attentes';

type AttentesUserStatus = 'invited' | 'started' | 'completed';

interface AttentesAttente {
  id: number;
  label: string;
}

export interface AttentesReponse {
  id: number;
  valeur: number;
  label: string;
}

export interface AttentesFacteur {
  id: number;
  facteur: string;
  titre: string;
  label: string;
  question: string;
  reponses: AttentesReponse[];
}

export interface AttentesAffirmation {
  id: number;
  label: string;
  image: string;
  attente: number;
}

export interface AttentesAtlas {
  titre: string;
  facteurs: AttentesFacteur[];
  attentes: AttentesAttente[];
  affirmations: AttentesAffirmation[];
  facteurById: Map<number, AttentesFacteur>;
  attenteById: Map<number, AttentesAttente>;
  affirmationById: Map<number, AttentesAffirmation>;
}

export interface AttentesPromptQuestion {
  facteur: AttentesFacteur;
  affirmation: AttentesAffirmation;
}

export interface AttentesAnswerInput {
  facteurId: number;
  affirmationId: number;
  attenteId: number;
  reponseId: number;
}

export interface AttentesAnswerEntry {
  quizId: string;
  facteurId: number;
  affirmationId: number;
  attenteId: number;
  reponseId: number;
  answeredAt: string;
}

interface AttentesUserResponsesNode {
  status: AttentesUserStatus;
  updatedAt: string;
  responses: AttentesAnswerEntry[];
}

export interface AttentesPromptState {
  question: AttentesPromptQuestion | null;
  totalCount: number;
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface AttentesSubmitAnswerResult {
  answeredCount: number;
  remainingCount: number;
  isCompleted: boolean;
}

export interface AttentesDimensionScore {
  attenteId: number;
  facteurId: number;
  key: string;
  label: string;
  labelDetail: string;
  questionCount: number;
  answeredCount: number;
  points: number;
  maxPoints: number;
  score: number;
}

export interface AttentesAttenteStats {
  attenteId: number;
  title: string;
  labels: string[];
  scores: number[];
  dimensions: AttentesDimensionScore[];
}

export interface AttentesSessionStats {
  title: string;
  attentes: AttentesAttenteStats[];
  answeredCount: number;
  totalCount: number;
  remainingCount: number;
  isCompleted: boolean;
  updatedAt: string;
}

interface AttentesEligibleSession {
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

const normalizeReponse = (payload: unknown): AttentesReponse | null => {
  const record = asRecord(payload);
  const id = readNumber(record['id']);
  const valeur = readNumber(record['valeur']);
  if (id === null || valeur === null) {
    return null;
  }

  return {
    id,
    valeur,
    label: readString(record['label']),
  };
};

const normalizeFacteur = (payload: unknown): AttentesFacteur | null => {
  const record = asRecord(payload);
  const id = readNumber(record['id']);
  if (id === null) {
    return null;
  }

  const reponses = Array.isArray(record['reponses'])
    ? record['reponses']
        .map((rawReponse) => normalizeReponse(rawReponse))
        .filter((reponse): reponse is AttentesReponse => reponse !== null)
    : [];

  return {
    id,
    facteur: readString(record['facteur']),
    titre: readString(record['titre']),
    label: readString(record['label']),
    question: readString(record['question']),
    reponses,
  };
};

const normalizeAttente = (payload: unknown): AttentesAttente | null => {
  const record = asRecord(payload);
  const id = readNumber(record['id']);
  if (id === null) {
    return null;
  }

  return {
    id,
    label: readString(record['label']),
  };
};

const normalizeAffirmation = (payload: unknown): AttentesAffirmation | null => {
  const record = asRecord(payload);
  const id = readNumber(record['id']);
  const attente = readNumber(record['attente']);
  if (id === null || attente === null) {
    return null;
  }

  return {
    id,
    label: readString(record['label']),
    image: readString(record['image']),
    attente,
  };
};

const normalizeAtlas = (payload: unknown): AttentesAtlas => {
  const record = asRecord(payload);

  const facteurs = Array.isArray(record['facteurs'])
    ? record['facteurs']
        .map((rawFacteur) => normalizeFacteur(rawFacteur))
        .filter((facteur): facteur is AttentesFacteur => facteur !== null)
    : [];

  const attentes = Array.isArray(record['attentes'])
    ? record['attentes']
        .map((rawAttente) => normalizeAttente(rawAttente))
        .filter((attente): attente is AttentesAttente => attente !== null)
    : [];

  const affirmations = Array.isArray(record['affirmations'])
    ? record['affirmations']
        .map((rawAffirmation) => normalizeAffirmation(rawAffirmation))
        .filter((affirmation): affirmation is AttentesAffirmation => affirmation !== null)
    : [];

  return {
    titre: readString(record['titre']),
    facteurs,
    attentes,
    affirmations,
    facteurById: new Map(facteurs.map((facteur) => [facteur.id, facteur])),
    attenteById: new Map(attentes.map((attente) => [attente.id, attente])),
    affirmationById: new Map(affirmations.map((affirmation) => [affirmation.id, affirmation])),
  };
};

const normalizeAnswerEntry = (payload: unknown): AttentesAnswerEntry | null => {
  const record = asRecord(payload);
  const facteurId = readNumber(record['facteurId']);
  const affirmationId = readNumber(record['affirmationId']);
  const attenteId = readNumber(record['attenteId']);
  const reponseId = readNumber(record['reponseId']);

  if (facteurId === null || affirmationId === null || attenteId === null || reponseId === null) {
    return null;
  }

  return {
    quizId: readString(record['quizId']),
    facteurId,
    affirmationId,
    attenteId,
    reponseId,
    answeredAt: readString(record['answeredAt']),
  };
};

const normalizeUserResponsesNode = (payload: unknown): AttentesUserResponsesNode => {
  const record = asRecord(payload);

  const rawStatus = readString(record['status']).toLowerCase();
  const status: AttentesUserStatus =
    rawStatus === 'started' || rawStatus === 'completed' ? rawStatus : 'invited';

  const responses = Array.isArray(record['responses'])
    ? record['responses']
        .map((rawEntry) => normalizeAnswerEntry(rawEntry))
        .filter((entry): entry is AttentesAnswerEntry => entry !== null)
    : [];

  return {
    status,
    updatedAt: readString(record['updatedAt']),
    responses,
  };
};

const buildQuestionKey = (facteurId: number, affirmationId: number): string =>
  `${facteurId}::${affirmationId}`;

const parseQuestionKey = (questionKey: string, atlas: AttentesAtlas): AttentesPromptQuestion | null => {
  const [rawFacteurId, rawAffirmationId] = questionKey.split('::');
  const facteurId = readNumber(rawFacteurId);
  const affirmationId = readNumber(rawAffirmationId);
  if (facteurId === null || affirmationId === null) {
    return null;
  }

  const facteur = atlas.facteurById.get(facteurId);
  const affirmation = atlas.affirmationById.get(affirmationId);
  if (!facteur || !affirmation) {
    return null;
  }

  return { facteur, affirmation };
};

const buildAllQuestionKeys = (atlas: AttentesAtlas): string[] =>
  atlas.facteurs.flatMap((facteur) =>
    atlas.affirmations.map((affirmation) => buildQuestionKey(facteur.id, affirmation.id)),
  );

const dedupeResponses = (responses: AttentesAnswerEntry[]): AttentesAnswerEntry[] => {
  const seenByQuestion = new Set<string>();
  const deduped: AttentesAnswerEntry[] = [];

  responses.forEach((response) => {
    const key = `${response.quizId}::${buildQuestionKey(response.facteurId, response.affirmationId)}`;
    if (seenByQuestion.has(key)) {
      return;
    }

    seenByQuestion.add(key);
    deduped.push(response);
  });

  return deduped;
};

const getAnsweredQuestionKeys = (responses: AttentesAnswerEntry[]): Set<string> => {
  const keys = new Set<string>();

  responses.forEach((response) => {
    if (response.quizId === ATTENTES_QUIZ_ID) {
      keys.add(buildQuestionKey(response.facteurId, response.affirmationId));
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
