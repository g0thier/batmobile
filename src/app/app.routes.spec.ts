import { authGuard } from './core/auth/guards/auth-guard';
import { guestGuard } from './core/auth/guards/guest-guard';
import { routes } from './app.routes';

describe('app routes', () => {
  const getRoute = (path: string) => routes.find((route) => route.path === path);

  it('redirects the root path to login', () => {
    expect(getRoute('')?.redirectTo).toBe('login');
  });

  it('keeps guest routes behind the guest guard', () => {
    expect(getRoute('login')?.canActivate).toEqual([guestGuard]);
    expect(getRoute('reset-password')?.canActivate).toEqual([guestGuard]);
  });

  it('keeps tabs behind the auth guard and exposes the expected children', () => {
    const tabsRoute = getRoute('tabs');
    expect(tabsRoute?.canActivate).toEqual([authGuard]);
    expect(tabsRoute?.children?.map((child) => child.path)).toEqual([
      '',
      'quiz',
      'quiz-session',
      'quiz-stats/:quizId/:sessionId',
      'success',
      'history',
      'profile',
    ]);
  });

  it('keeps unknown routes redirecting to login', () => {
    expect(routes.at(-1)?.path).toBe('**');
    expect(routes.at(-1)?.redirectTo).toBe('login');
  });
});

