import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { BesoinsAcquisSession } from './besoins-acquis-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('BesoinsAcquisSession', () => {
  const database = {} as Database;
  let service: BesoinsAcquisSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BesoinsAcquisSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(BesoinsAcquisSession);
  });

  it('returns a prompt with the remaining question', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Besoins acquis',
          besoins: [{ id: 1, key: 'k1', label: 'Besoin 1' }],
          questions: [{ id: 1, besoin: 1, label: 'Question 1' }],
          reponses: [
            { id: 1, label: 'Oui', valeur: 1 },
            { id: 2, label: 'Non', valeur: 0 },
          ],
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

    expect(prompt.question?.id).toBe(1);
    expect(prompt.reponses.length).toBe(2);
    expect(prompt.isCompleted).toBeFalse();
  });

  it('submits an answer and writes the response node', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Besoins acquis',
          besoins: [{ id: 1, key: 'k1', label: 'Besoin 1' }],
          questions: [{ id: 1, besoin: 1, label: 'Question 1' }],
          reponses: [
            { id: 1, label: 'Oui', valeur: 1 },
            { id: 2, label: 'Non', valeur: 0 },
          ],
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
      questionId: 1,
      reponseId: 1,
      besoinId: 1,
    });

    expect(setSpy).toHaveBeenCalled();
    expect(result).toEqual({
      answeredCount: 1,
      remainingCount: 0,
      isCompleted: true,
    });
  });
});
