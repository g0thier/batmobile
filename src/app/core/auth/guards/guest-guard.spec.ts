import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from '../auth';
import { guestGuard } from './guest-guard';

describe('guestGuard', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue({} as UrlTree);
  });

  it('lets guests continue', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated$: of(false) } },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    await expectAsync(firstValueFrom(result as never)).toBeResolvedTo(true);
  });

  it('redirects authenticated users to quiz', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated$: of(true) } },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    await expectAsync(firstValueFrom(result as never)).toBeResolvedTo(routerSpy.createUrlTree.calls.first().returnValue);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/tabs/quiz']);
  });
});

