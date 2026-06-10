import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { TheorieXYSession } from '../../../../../core/quiz/theorie-x-y-session';
import { TheorieXYQuizComponent } from './theorie-x-y-quiz.component';

describe('TheorieXYQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TheorieXYQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'theorie-x-y',
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
          provide: TheorieXYSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitAnswer: jasmine.createSpy('submitAnswer'),
          },
        },
      ],
    }).compileComponents();
  });

  it('accepts keyboard choices and keeps the current selection', async () => {
    const fixture = TestBed.createComponent(TheorieXYQuizComponent);
    fixture.componentInstance.affirmation = {
      id: 1,
      theme: 1,
      x: 'X',
      y: 'Y',
    } as never;
    spyOn(fixture.componentInstance, 'onValidateTap').and.resolveTo();

    const event = {
      key: 'Enter',
      preventDefault: jasmine.createSpy('preventDefault'),
    } as KeyboardEvent & { preventDefault: jasmine.Spy };

    await fixture.componentInstance.onChoiceKeyDown(event, 1);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(fixture.componentInstance.selectedResponseId).toBe(1);
  });
});
