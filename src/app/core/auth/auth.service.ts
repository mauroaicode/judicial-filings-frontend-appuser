import {HttpClient} from '@angular/common/http';
import {inject, Injectable, signal} from '@angular/core';
import {Observable, of} from 'rxjs';
import {environment} from '@app/core/config/environment.config';
import {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  TwoFactorSetupResponse,
  TwoFactorTokenResponse,
  User,
  VerifyPasswordRequest,
  VerifyPasswordResponse
} from '@app/core/models/auth/auth.model';
import {SessionStorageService} from '@app/core/services/storage/session-storage.service';
import {STORAGE} from '@app/core/constants/storage.constant';
import {
  safeGetLocalStorageItem,
  safeRemoveLocalStorageItem,
  safeSetLocalStorageItem,
} from '@app/core/utils/local-storage.util';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _httpClient = inject(HttpClient);
  private _sessionStorageService = inject(SessionStorageService);

  private _user = signal<User | null>(null);
  private _token = signal<string | null>(null);
  private _awaitingTwoFactor = signal(false);

  public readonly user = this._user.asReadonly();
  public readonly token = this._token.asReadonly();
  public readonly isAwaitingTwoFactor = this._awaitingTwoFactor.asReadonly();

  public readonly isAuthenticated = signal<boolean>(false);

  private _onAccessTokenChange: ((token: string | null) => void) | null = null;

  constructor() {
    this._loadFromStorage();
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Accessors
  // -----------------------------------------------------------------------------------------------------

  /**
   * Getter for access token
   */
  get accessToken(): string | null {
    return this._token() || this._sessionStorageService.getJwt();
  }

  /**
   * Setter for access token
   */
  set accessToken(token: string | null) {
    if (token) {
      this._token.set(token);
      this._sessionStorageService.saveJwt(token);
      safeSetLocalStorageItem(STORAGE.JWT, token);
      this._notifyAccessTokenChange(this._sessionTokenForClients());
      return;
    }
    this._token.set(null);
    this._sessionStorageService.removeJwt();
    safeRemoveLocalStorageItem(STORAGE.JWT);
    this._notifyAccessTokenChange(null);
  }

  /**
   * Notifies when the access token is stored or removed.
   * Invokes the listener immediately with the current token.
   */
  onAccessTokenChange(listener: (token: string | null) => void): void {
    this._onAccessTokenChange = listener;
    listener(this._sessionTokenForClients());
  }

  /**
   * True when the stored token may call the rest of the API.
   * A login token that still needs a TOTP code is not enough.
   */
  canEnterApp(): boolean {
    return !!this.accessToken && !!this.currentUser && !this._awaitingTwoFactor();
  }

  /**
   * Getter for organization ID
   */
  get organizationId(): string | null {
    return this._user()?.organization_id || null;
  }

  /**
   * Getter for current user
   */
  get currentUser(): User | null {
    return this._user();
  }

  /**
   * Setter for current user
   */
  set currentUser(user: User | null) {
    this._user.set(user);
    if (user) {
      safeSetLocalStorageItem(STORAGE.USER, JSON.stringify(user));
      this.isAuthenticated.set(!this._awaitingTwoFactor());
      return;
    }
    safeRemoveLocalStorageItem(STORAGE.USER);
    this.isAuthenticated.set(false);
  }

  /**
   * Merges fields into the stored user, for example after profile or 2FA changes.
   */
  updateCurrentUser(patch: Partial<User>): void {
    const current = this._user();
    if (!current) return;
    this.currentUser = { ...current, ...patch };
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Sign in
   *
   * @param credentials - Login credentials
   * @returns Observable with auth response
   */
  signIn(credentials: LoginRequest): Observable<AuthResponse> {
    const url = `${environment.apiBaseUrl}/login`;
    return this._httpClient.post<AuthResponse>(url, credentials);
  }

  /**
   * Stores the login token and user. When 2FA is required, other clients
   * keep seeing no session token until validate replaces it.
   */
  acceptLogin(response: AuthResponse): void {
    this._setAwaitingTwoFactor(!!response.requires_2fa);
    this.accessToken = response.token;
    this.currentUser = response.user;
    safeRemoveLocalStorageItem(STORAGE.SESSION_LOCKED);
  }

  /**
   * Replaces the current token with the one returned by verify, validate or disable.
   * Those endpoints delete every previous token.
   */
  replaceAccessToken(token: string): void {
    this._setAwaitingTwoFactor(false);
    this.accessToken = token;
  }

  /**
   * Keeps the login token for POST /2fa/validate and blocks the rest of the API.
   */
  beginTwoFactorChallenge(): void {
    if (this._awaitingTwoFactor()) return;
    this._setAwaitingTwoFactor(true);
    this._notifyAccessTokenChange(null);
  }

  generateTwoFactor(): Observable<TwoFactorSetupResponse> {
    return this._httpClient.get<TwoFactorSetupResponse>(`${environment.apiBaseUrl}/2fa/generate`);
  }

  verifyTwoFactor(oneTimePassword: string): Observable<TwoFactorTokenResponse> {
    return this._httpClient.post<TwoFactorTokenResponse>(`${environment.apiBaseUrl}/2fa/verify`, {
      one_time_password: oneTimePassword,
    });
  }

  validateTwoFactor(oneTimePassword: string): Observable<TwoFactorTokenResponse> {
    return this._httpClient.post<TwoFactorTokenResponse>(`${environment.apiBaseUrl}/2fa/validate`, {
      one_time_password: oneTimePassword,
    });
  }

  disableTwoFactor(): Observable<TwoFactorTokenResponse> {
    return this._httpClient.patch<TwoFactorTokenResponse>(`${environment.apiBaseUrl}/2fa/disable`, {});
  }

  /**
   * Forgot password request
   *
   * @param data - Forgot password request data
   * @returns Observable
   */
  forgotPassword(data: ForgotPasswordRequest): Observable<any> {
    const url = `${environment.apiBaseUrl}/forgot-password`;
    return this._httpClient.post(url, data);
  }

  /**
   * Reset password request
   *
   * @param data - Reset password request data
   * @returns Observable
   */
  resetPassword(data: ResetPasswordRequest): Observable<any> {
    const url = `${environment.apiBaseUrl}/reset-password`;
    return this._httpClient.post(url, data);
  }

  /**
   * Verify current user password to unlock session
   *
   * @param data - Password verification payload
   * @returns Observable with unlock result message
   */
  verifyPassword(data: VerifyPasswordRequest): Observable<VerifyPasswordResponse> {
    const url = `${environment.apiBaseUrl}/verify-password`;
    return this._httpClient.post<VerifyPasswordResponse>(url, data);
  }

  /**
   * Unlocks the local inactivity lock with the authenticator code.
   * Does not replace the current token.
   */
  verifyOtp(oneTimePassword: string): Observable<VerifyPasswordResponse> {
    const url = `${environment.apiBaseUrl}/verify-otp`;
    return this._httpClient.post<VerifyPasswordResponse>(url, {
      one_time_password: oneTimePassword,
    });
  }

  /**
   * Sign out
   */
  signOut(): Observable<boolean> {
    this._setAwaitingTwoFactor(false);
    this.accessToken = null;
    this.currentUser = null;
    safeRemoveLocalStorageItem(STORAGE.SESSION_LOCKED);

    return of(true);
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Private methods
  // -----------------------------------------------------------------------------------------------------

  private _notifyAccessTokenChange(token: string | null): void {
    this._onAccessTokenChange?.(token);
  }

  /**
   * Token exposed to websocket and other session clients.
   * Hidden while the login token still needs a TOTP code.
   */
  private _sessionTokenForClients(): string | null {
    if (this._awaitingTwoFactor()) return null;
    return this._token();
  }

  private _setAwaitingTwoFactor(awaiting: boolean): void {
    this._awaitingTwoFactor.set(awaiting);
    if (awaiting) {
      safeSetLocalStorageItem(STORAGE.PENDING_2FA, '1');
    } else {
      safeRemoveLocalStorageItem(STORAGE.PENDING_2FA);
    }
    this.isAuthenticated.set(!!this._user() && !awaiting);
  }

  /**
   * Load user and token from storage
   */
  private _loadFromStorage(): void {
    const token = this._sessionStorageService.getJwt() || safeGetLocalStorageItem(STORAGE.JWT);
    const userStr = safeGetLocalStorageItem(STORAGE.USER);
    const awaiting = safeGetLocalStorageItem(STORAGE.PENDING_2FA) === '1';

    if (token) {
      this._token.set(token);
    }

    if (awaiting && token) {
      this._awaitingTwoFactor.set(true);
    } else if (awaiting) {
      safeRemoveLocalStorageItem(STORAGE.PENDING_2FA);
    }

    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        this._user.set(user);
        this.isAuthenticated.set(!this._awaitingTwoFactor());
      } catch (error) {
        console.error('Error parsing user from storage:', error);
        safeRemoveLocalStorageItem(STORAGE.USER);
        safeRemoveLocalStorageItem(STORAGE.JWT);
        safeRemoveLocalStorageItem(STORAGE.PENDING_2FA);
        this._token.set(null);
        this._awaitingTwoFactor.set(false);
        this._sessionStorageService.removeJwt();
      }
    }
  }
}

