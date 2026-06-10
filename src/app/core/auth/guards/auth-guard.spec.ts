import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from '../auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue({} as UrlTree);
  });

  it('allows authenticated users', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated$: of(true) } },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    await expectAsync(firstValueFrom(result as never)).toBeResolvedTo(true);
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects anonymous users to login', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated$: of(false) } },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    await expectAsync(firstValueFrom(result as never)).toBeResolvedTo(routerSpy.createUrlTree.calls.first().returnValue);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});

