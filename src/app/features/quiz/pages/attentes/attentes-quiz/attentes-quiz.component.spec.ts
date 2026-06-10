import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { AttentesSession } from '../../../../../core/quiz/attentes-session';
import { AttentesQuizComponent } from './attentes-quiz.component';

describe('AttentesQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttentesQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'attentes',
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
          provide: AttentesSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('accepts only valid response selections', () => {
    const fixture = TestBed.createComponent(AttentesQuizComponent);
    fixture.componentInstance.responses = [
      { id: 1, label: 'Non' } as never,
      { id: 2, label: 'Oui' } as never,
    ];

    fixture.componentInstance.onResponseChange({
      detail: { value: 2 },
    } as never);

    expect(fixture.componentInstance.selectedResponseId).toBe(2);
  });
});

