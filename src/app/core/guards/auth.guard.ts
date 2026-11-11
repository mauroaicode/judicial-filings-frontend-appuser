import {inject} from '@angular/core';
import {Router, type CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
import {AuthService} from '@app/core/auth/auth.service';
import {ROUTES_ADMIN} from '@app/core/constants/router.constant';
import {User} from '@app/core/models/auth/auth.model';

/**
 * Auth Guard
 * Protects routes that require authentication
 */
export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> => {
  const authService = inject(AuthService);
  const router: Router = inject(Router);

  const token: string | null = authService.accessToken;
  const user: User | null = authService.currentUser;

  if (authService.isAwaitingTwoFactor()) {
    await router.navigate([ROUTES_ADMIN.TWO_FACTOR_CHALLENGE]);
    return false;
  }

  if (!token || !user) {
    await router.navigate(['/sign-in'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  return true;
};

