import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { QuizSessionContextService } from '../../../../../core/quiz/quiz-session-context.service';
import { MimetismeSession } from '../../../../../core/quiz/mimetisme-session';
import { MimetismeQuizComponent } from './mimetisme-quiz.component';

describe('MimetismeQuizComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MimetismeQuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: { authUser$: of({ uid: 'user-1' }) } },
        {
          provide: QuizSessionContextService,
          useValue: {
            getCurrentSession: () => ({
              sessionId: 'session-1',
              quizId: 'mimetisme',
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
          provide: MimetismeSession,
          useValue: {
            getPromptForSession: jasmine.createSpy('getPromptForSession'),
            submitChoice: jasmine.createSpy('submitChoice'),
          },
        },
      ],
    }).compileComponents();
  });

  it('tracks portrait availability and resolves portrait urls', () => {
    const fixture = TestBed.createComponent(MimetismeQuizComponent);

    expect(fixture.componentInstance.hasPortrait(1)).toBeTrue();
    fixture.componentInstance.onPortraitError(1);
    expect(fixture.componentInstance.hasPortrait(1)).toBeFalse();
    expect(fixture.componentInstance.resolvePortraitUrl('  src/module/portrait.png ')).toBe('/module/portrait.png');
  });
});

