import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { BesoinsAcquisSession } from '../../../../../core/quiz/besoins-acquis-session';
import { BesoinsAcquisQuizComponent } from './besoins-acquis-quiz.component';

describe('BesoinsAcquisQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BesoinsAcquisQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'besoins-acquis',
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
          provide: BesoinsAcquisSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('accepts only valid responses', () => {
    const fixture = TestBed.createComponent(BesoinsAcquisQuizComponent);
    fixture.componentInstance.responses = [
      { id: 1, label: 'Oui' } as never,
      { id: 2, label: 'Non' } as never,
    ];

    fixture.componentInstance.onResponseChange({
      detail: { value: 1 },
    } as never);

    expect(fixture.componentInstance.selectedResponseId).toBe(1);
  });
});

