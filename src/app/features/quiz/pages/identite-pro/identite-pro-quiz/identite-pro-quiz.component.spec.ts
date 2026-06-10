import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { IdentiteProSession } from '../../../../../core/quiz/identite-pro-session';
import { IdentiteProQuizComponent } from './identite-pro-quiz.component';

describe('IdentiteProQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentiteProQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'identite-pro',
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
          provide: IdentiteProSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('detects perceived identity questions', () => {
    const fixture = TestBed.createComponent(IdentiteProQuizComponent);
    fixture.componentInstance.question = {
      dimension: {
        key: 'identite_percue',
      },
    } as never;

    expect(fixture.componentInstance.isPerceivedIdentityQuestion).toBeTrue();
  });
});

