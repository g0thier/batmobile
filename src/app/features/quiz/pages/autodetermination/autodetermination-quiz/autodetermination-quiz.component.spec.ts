import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { AutodeterminationSession } from '../../../../../core/quiz/autodetermination-session';
import { AutodeterminationQuizComponent } from './autodetermination-quiz.component';

describe('AutodeterminationQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutodeterminationQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'autodetermination',
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
          provide: AutodeterminationSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('accepts keyboard choices on Enter', async () => {
    const fixture = TestBed.createComponent(AutodeterminationQuizComponent);
    fixture.componentInstance.affirmation = {
      id: 1,
      theme: 1,
      label: 'A',
    } as never;
    spyOn(fixture.componentInstance, 'onValidateTap').and.resolveTo();

    const event = {
      key: 'Enter',
      preventDefault: jasmine.createSpy('preventDefault'),
    } as KeyboardEvent & { preventDefault: jasmine.Spy };

    await fixture.componentInstance.onChoiceKeyDown(event, 2);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(fixture.componentInstance.selectedResponseId).toBe(2);
  });
});
