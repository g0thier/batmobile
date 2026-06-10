import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { PyramideBesoinsSession } from '../../../../../core/quiz/pyramide-besoins-session';
import { PyramideBesoinsQuizComponent } from './pyramide-besoins-quiz.component';

describe('PyramideBesoinsQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PyramideBesoinsQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'pyramide-besoins',
              responseDeadline: '2025-01-01T12:00:00.000Z',
              status: 'started',
              createdAt: '2025-01-01T10:00:00.000Z',
              updatedAt: '2025-01-01T10:00:00.000Z',
            }),
            isMixedMode: () => false,
            advance: () => null,
            clearCurrentSession: () => void 0,
          },
        },
        {
          provide: PyramideBesoinsSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('selects a response only when it is part of the prompt', () => {
    const fixture = TestBed.createComponent(PyramideBesoinsQuizComponent);
    fixture.componentInstance.affirmation = {
      id: 1,
      besoin: 1,
      label: 'A',
    } as never;
    fixture.componentInstance.reponses = [{ id: 2, label: 'Oui', valeur: 1 } as never];

    fixture.componentInstance.onChoiceTap(2);

    expect(fixture.componentInstance.selectedReponseId).toBe(2);
  });
});

