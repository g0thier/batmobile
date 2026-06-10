import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { PyramideBesoinsSession } from './pyramide-besoins-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('PyramideBesoinsSession', () => {
  const database = {} as Database;
  let service: PyramideBesoinsSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PyramideBesoinsSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(PyramideBesoinsSession);
  });

  it('returns a question prompt', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Pyramide',
          besoins: [{ id: 1, key: 'k1', label: 'Besoin 1' }],
          reponses: [
            { id: 1, label: 'Oui', valeur: 1 },
            { id: 2, label: 'Non', valeur: 0 },
          ],
          affirmations: [{ id: 1, label: 'Affirmation 1', besoin: 1 }],
        }),
      ),
    );
    spyOn(firebaseDatabase, 'ref').and.callFake((...args: any[]) => ({ path: args[1] ?? '' } as never));
    spyOn(firebaseDatabase, 'get').and.callFake(async () =>
      createPresentSnapshot({
        status: 'invited',
        updatedAt: '',
        responses: [],
      }) as any,
    );

    const prompt = await service.getPromptForSession('session-1', 'user-1');

    expect(prompt.affirmation?.id).toBe(1);
    expect(prompt.isCompleted).toBeFalse();
  });

  it('submits an answer', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Pyramide',
          besoins: [{ id: 1, key: 'k1', label: 'Besoin 1' }],
          reponses: [
            { id: 1, label: 'Oui', valeur: 1 },
            { id: 2, label: 'Non', valeur: 0 },
          ],
          affirmations: [{ id: 1, label: 'Affirmation 1', besoin: 1 }],
        }),
      ),
    );
    spyOn(firebaseDatabase, 'ref').and.callFake((...args: any[]) => ({ path: args[1] ?? '' } as never));
    spyOn(firebaseDatabase, 'get').and.callFake(async () =>
      createPresentSnapshot({
        status: 'invited',
        updatedAt: '',
        responses: [],
      }) as any,
    );
    const setSpy = spyOn(firebaseDatabase, 'set').and.resolveTo();

    const result = await service.submitAnswer('session-1', 'user-1', {
      affirmationId: 1,
      reponseId: 1,
      besoinId: 1,
    });

    expect(setSpy).toHaveBeenCalled();
    expect(result.isCompleted).toBeTrue();
  });
});
