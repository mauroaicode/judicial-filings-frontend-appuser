import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '@app/core/auth/auth.service';
import { ROLE_ROUTE_MAP, ROUTES_ADMIN } from '@app/core/constants/router.constant';
import type { RoleName } from '@app/core/constants/router.constant';

/**
 * Allows the TOTP screen only while the login token still needs a code.
 * A verified session goes to the app. No session goes back to sign-in.
 */
export const twoFactorChallengeGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAwaitingTwoFactor() && authService.accessToken && authService.currentUser) {
    return true;
  }

  if (authService.canEnterApp()) {
    const user = authService.currentUser;
    for (const role of user?.roles ?? []) {
      const routePath = ROLE_ROUTE_MAP[role.value as RoleName];
      if (routePath) {
        await router.navigate([routePath]);
        return false;
      }
    }

    await router.navigate([ROUTES_ADMIN.GESTION_PROCESOS]);
    return false;
  }

  await router.navigate([ROUTES_ADMIN.SIGN_IN]);
  return false;
};
