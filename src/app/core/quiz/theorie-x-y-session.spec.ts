import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { TheorieXYSession } from './theorie-x-y-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('TheorieXYSession', () => {
  const database = {} as Database;
  let service: TheorieXYSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TheorieXYSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(TheorieXYSession);
  });

  it('returns a prompt and submits answers', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Théorie X-Y',
          titre: 'Théorie X-Y',
          themes: [{ id: 1, label: 'T1' }],
          reponses: [
            { id: 1, label: 'X', valeur: 0 },
            { id: 2, label: 'Y', valeur: 1 },
          ],
          affirmations: [{ id: 1, theme: 1, x: 'X', y: 'Y' }],
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

    const prompt = await service.getPromptForSession('session-1', 'user-1');
    const result = await service.submitAnswer('session-1', 'user-1', {
      affirmationId: 1,
      themeId: 1,
      responseId: 2,
    });

    expect(prompt.affirmation?.id).toBe(1);
    expect(setSpy).toHaveBeenCalled();
    expect(result.isCompleted).toBeTrue();
  });
});
