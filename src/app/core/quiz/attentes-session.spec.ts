import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import * as firebaseDatabase from 'firebase/database';
import { AttentesSession, type AttentesAtlas } from './attentes-session';

describe('AttentesSession', () => {
  const database = {} as Database;
  let service: AttentesSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AttentesSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(AttentesSession);
  });

  it('writes the quiz response node without relying on success cache', async () => {
    const facteur = {
      id: 1,
      facteur: 'motivation',
      titre: 'Motivation',
      label: 'Motivation',
      question: '',
      reponses: [{ id: 1, valeur: 1, label: 'Oui' }],
    };
    const attente = { id: 1, label: 'Attente' };
    const affirmation = { id: 1, label: 'Affirmation', image: '', attente: 1 };
    const atlas: AttentesAtlas = {
      titre: 'Attentes',
      facteurs: [facteur],
      attentes: [attente],
      affirmations: [affirmation],
      facteurById: new Map([[1, facteur]]),
      attenteById: new Map([[1, attente]]),
      affirmationById: new Map([[1, affirmation]]),
    };

    spyOn(service, 'loadAtlas').and.resolveTo(atlas);
    spyOn<any>(service as any, 'readUserResponsesNode').and.resolveTo({
      status: 'invited',
      updatedAt: '',
      responses: [],
    });
    const refSpy = spyOn(firebaseDatabase, 'ref').and.returnValue({} as never);
    const setSpy = spyOn(firebaseDatabase, 'set').and.resolveTo();

    const result = await service.submitAnswer('session-1', 'user-1', {
      facteurId: 1,
      affirmationId: 1,
      attenteId: 1,
      reponseId: 1,
    });

    expect(refSpy).toHaveBeenCalledWith(database, 'quizSessions/session-1/responsesByUser/user-1');
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      answeredCount: 1,
      remainingCount: 0,
      isCompleted: true,
    });
  });
});
