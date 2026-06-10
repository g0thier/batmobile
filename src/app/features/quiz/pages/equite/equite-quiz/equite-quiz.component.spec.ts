import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { EquiteSession } from '../../../../../core/quiz/equite-session';
import { EquiteQuizComponent } from './equite-quiz.component';

describe('EquiteQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquiteQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'equite',
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
          provide: EquiteSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('derives the score and image scale from the range value', () => {
    const fixture = TestBed.createComponent(EquiteQuizComponent);
    fixture.componentInstance.rangeValue = 8;

    expect(fixture.componentInstance.responseId).toBe(3);
    expect(fixture.componentInstance.contributionsScore).toBe(2);
    expect(fixture.componentInstance.retributionsScore).toBe(8);
    expect(fixture.componentInstance.leftImageTransform).toContain('scale(');
    expect(fixture.componentInstance.rightImageTransform).toContain('scale(');
  });
});

