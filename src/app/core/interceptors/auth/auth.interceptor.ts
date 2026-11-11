import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/core/auth/auth.service';
import { AuthUtils } from '@app/core/auth/auth.utils';
import { ROUTES_ADMIN } from '@app/core/constants/router.constant';
import { Observable, catchError, throwError } from 'rxjs';

/**
 * Auth Interceptor
 * Adds Authorization header to requests and handles 401 errors
 *
 * @param req - HTTP request
 * @param next - HTTP handler
 * @returns Observable with HTTP event
 */
const TWO_FACTOR_REQUIRED_SNIPPET = 'autenticación en dos factores';

export const authInterceptor = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Clone the request object
  let newReq = req.clone();

  // Request
  //
  // For Laravel Sanctum, we add the Authorization header if the token exists.
  // The server will validate if the token is expired or invalid and return 401.
  const token = authService.accessToken;
  if (token && AuthUtils.isTokenValid(token)) {
    newReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  // Response
  return next(newReq).pipe(
    catchError((error) => {
      const isPublicAuthRequest =
        req.url.includes('/login') ||
        req.url.includes('/forgot-password') ||
        req.url.includes('/reset-password') ||
        req.url.includes('/verify-password');

      // The login token is rejected everywhere except the 2FA routes until the code is validated.
      // Keep the session so the user can enter the code. Do not sign out.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        !req.url.includes('/2fa/') &&
        isTwoFactorRequiredError(error)
      ) {
        authService.beginTwoFactorChallenge();
        if (!router.url.startsWith(ROUTES_ADMIN.TWO_FACTOR_CHALLENGE)) {
          void router.navigate([ROUTES_ADMIN.TWO_FACTOR_CHALLENGE]);
        }
        return throwError(() => error);
      }

      // Catch "401 Unauthorized" responses on authenticated requests only
      if (error instanceof HttpErrorResponse && error.status === 401 && !isPublicAuthRequest) {
        authService.signOut();
        location.reload();
      }

      return throwError(() => error);
    })
  );
};

function isTwoFactorRequiredError(error: HttpErrorResponse): boolean {
  const messages = error.error?.messages;
  if (!Array.isArray(messages)) return false;

  return messages.some(
    (message) =>
      typeof message === 'string' &&
      message.toLowerCase().includes(TWO_FACTOR_REQUIRED_SNIPPET)
  );
}

