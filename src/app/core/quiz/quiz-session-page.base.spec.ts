import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth';
import { QuizSessionContextService } from './quiz-session-context.service';
import { QuizSessionPageBase, type QuizPromptState, type QuizSubmitResult } from './quiz-session-page.base';

interface TestPromptState extends QuizPromptState {
  totalCount: number;
  isCompleted: boolean;
}

interface TestSubmitResult extends QuizSubmitResult {
  isCompleted: boolean;
  answeredCount: number;
}

@Component({
  standalone: true,
  template: '',
})
class TestQuizPageComponent extends QuizSessionPageBase<TestPromptState, TestSubmitResult> {
  protected override readonly expectedQuizId = 'attentes';
  prompt: TestPromptState = { totalCount: 1, isCompleted: false };
  submitResult: TestSubmitResult = { isCompleted: false, answeredCount: 1 };
  canSubmitFlag = true;
  readPromptCalls = 0;
  submitCalls = 0;

  protected override canSubmit(): boolean {
    return this.canSubmitFlag;
  }

  protected override readPromptState(): Promise<TestPromptState> {
    this.readPromptCalls += 1;
    return Promise.resolve(this.prompt);
  }

  protected override applyPromptState(_prompt: TestPromptState): void {}

  protected override getAnsweredCount(prompt: TestPromptState): number {
    return prompt.isCompleted ? prompt.totalCount : 0;
  }

  protected override getAnsweredCountFromSubmitResult(result: TestSubmitResult): number {
    return result.answeredCount;
  }

  protected override submitCurrentAnswer(): Promise<TestSubmitResult> {
    this.submitCalls += 1;
    return Promise.resolve(this.submitResult);
  }

  protected override async afterSuccessfulSubmission(): Promise<void> {}
}

describe('QuizSessionPageBase', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let authUser$: BehaviorSubject<{ uid: string } | null>;
  let sessionContextSpy: jasmine.SpyObj<QuizSessionContextService>;

  beforeEach(() => {
    authUser$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'user-1' });
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    sessionContextSpy = jasmine.createSpyObj<QuizSessionContextService>('QuizSessionContextService', [
      'getCurrentSession',
      'clearCurrentSession',
      'isMixedMode',
      'advance',
    ]);
    sessionContextSpy.getCurrentSession.and.returnValue({
      sessionId: 'session-1',
      quizId: 'attentes',
      responseDeadline: '2025-01-01T12:00:00.000Z',
      status: 'started',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T11:00:00.000Z',
    });
    sessionContextSpy.isMixedMode.and.returnValue(false);
    sessionContextSpy.advance.and.returnValue(null);

    TestBed.configureTestingModule({
      imports: [TestQuizPageComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        {
          provide: AuthService,
          useValue: {
            authUser$: authUser$.asObservable(),
          },
        },
        { provide: QuizSessionContextService, useValue: sessionContextSpy },
      ],
    });
  });

  it('redirects to history when no session is active', async () => {
    sessionContextSpy.getCurrentSession.and.returnValue(null);
    const fixture = TestBed.createComponent(TestQuizPageComponent);

    await fixture.componentInstance.ngOnInit();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/history', { replaceUrl: true });
  });

  it('loads a prompt and advances on mixed completion', async () => {
    sessionContextSpy.isMixedMode.and.returnValue(true);
    sessionContextSpy.advance.and.returnValue({
      sessionId: 'next-session',
      quizId: 'equite',
      responseDeadline: '2025-01-01T12:00:00.000Z',
      status: 'started',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T11:00:00.000Z',
    });

    const fixture = TestBed.createComponent(TestQuizPageComponent);
    const component = fixture.componentInstance as any;
    component.currentUserId = 'user-1';
    component.currentSession = {
      sessionId: 'session-1',
      quizId: 'attentes',
      responseDeadline: '2025-01-01T12:00:00.000Z',
      status: 'started',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T11:00:00.000Z',
    };
    component.prompt = { totalCount: 1, isCompleted: false };
    component.submitResult = { isCompleted: true, answeredCount: 1 };

    await fixture.componentInstance.onValidateTap();

    expect(sessionContextSpy.advance).toHaveBeenCalledWith(true);
  });

  it('resolves image urls consistently', () => {
    const fixture = TestBed.createComponent(TestQuizPageComponent);

    expect(fixture.componentInstance.resolveImageUrl('  images/photo.png ')).toBe('/images/photo.png');
    expect(fixture.componentInstance.resolveImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(fixture.componentInstance.resolveImageUrl(' /already/absolute ')).toBe('/already/absolute');
  });
});
