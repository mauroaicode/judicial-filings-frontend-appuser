import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';
import { STORAGE } from '@app/core/constants/storage.constant';
import {
  safeGetLocalStorageItem,
  safeRemoveLocalStorageItem,
  safeSetLocalStorageItem,
} from '@app/core/utils/local-storage.util';

@Injectable({
  providedIn: 'root',
})
export class SessionLockService {
  private _document = inject(DOCUMENT);
  private _authService = inject(AuthService);
  private _router = inject(Router);

  private _isLocked = signal(false);
  private _isInitialized = signal(false);
  private _isUnlocking = signal(false);
  private _lockTimeoutMs = signal<number | null>(null);

  public readonly isLocked = this._isLocked.asReadonly();
  public readonly isUnlocking = this._isUnlocking.asReadonly();

  private _idleTimerId: number | null = null;
  private _blockEventsAttached = false;
  private _activityListenersAttached = false;
  private _featureEnabled = true;

  private readonly _activityEvents: Array<keyof WindowEventMap> = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];

  private readonly _onActivityBound = this._onActivity.bind(this);
  private readonly _onBlockedInteractionBound = this._onBlockedInteraction.bind(this);
  private readonly _onBlockedKeydownBound = this._onBlockedKeydown.bind(this);

  private readonly _defaultLockTimeoutMinutes = 5;

  constructor() {
    this.initializeFromCurrentUser();
    window.addEventListener('pageshow', this._onPageShow);
  }

  initializeFromCurrentUser(): void {
    if (this._isInitialized()) {
      if (this._isLockPersisted() && !this._isLocked()) {
        this.lock();
      }
      return;
    }

    const user = this._authService.currentUser;
    if (!user || !this._authService.accessToken) return;

    const isEnabled = user.session_lock_enabled !== false;
    const timeoutMinutes = user.session_lock_timeout;
    const resolvedTimeoutMinutes =
      typeof timeoutMinutes === 'number' && Number.isFinite(timeoutMinutes) && timeoutMinutes > 0
        ? timeoutMinutes
        : this._defaultLockTimeoutMinutes;

    this._featureEnabled = isEnabled;
    this._lockTimeoutMs.set(resolvedTimeoutMinutes * 60_000);
    this._isInitialized.set(true);

    // A reload is not an unlock. The saved method is still required.
    if (this._isLockPersisted()) {
      this.lock();
      if (isEnabled) this._attachActivityListeners();
      return;
    }

    if (!isEnabled) return;

    this._attachActivityListeners();
    this.resetInactivityTimer();
  }

  private readonly _onPageShow = (): void => {
    if (this._isLockPersisted() && !this._isLocked()) {
      this.lock();
    }
  };

  resetInactivityTimer(): void {
    if (!this._isInitialized() || this._isLocked()) return;

    const timeoutMs = this._lockTimeoutMs();
    if (!timeoutMs) return;

    this._clearIdleTimer();
    this._idleTimerId = window.setTimeout(() => {
      this.lock();
    }, timeoutMs);
  }

  lock(): void {
    if (this._isLocked()) return;
    this._isLocked.set(true);
    this._persistLockState(true);
    this._attachBlockedInteractionGuards();
    this._clearIdleTimer();
  }

  unlock(): void {
    if (!this._isLocked()) return;
    this._isLocked.set(false);
    this._persistLockState(false);
    this._detachBlockedInteractionGuards();
    if (this._featureEnabled) {
      this.resetInactivityTimer();
    }
  }

  async verifyPasswordAndUnlock(password: string): Promise<void> {
    if (this._isUnlocking()) return;

    this._isUnlocking.set(true);
    try {
      await firstValueFrom(this._authService.verifyPassword({ password }));
      this.unlock();
    } finally {
      this._isUnlocking.set(false);
    }
  }

  /**
   * Unlocks with the authenticator code. The session token stays the same.
   */
  async verifyOtpAndUnlock(oneTimePassword: string): Promise<void> {
    if (this._isUnlocking()) return;

    this._isUnlocking.set(true);
    try {
      await firstValueFrom(this._authService.verifyOtp(oneTimePassword));
      this.unlock();
    } finally {
      this._isUnlocking.set(false);
    }
  }

  async forceLogoutForMissingLockTimeout(): Promise<void> {
    await firstValueFrom(this._authService.signOut());
    this._resetState();
    await this._router.navigate(['/sign-in']);
  }

  async logoutAndRedirectToSignIn(): Promise<void> {
    await firstValueFrom(this._authService.signOut());
    this._resetState();
    await this._router.navigate(['/sign-in']);
  }

  private _onActivity(): void {
    this.resetInactivityTimer();
  }

  private _attachActivityListeners(): void {
    if (this._activityListenersAttached) return;
    for (const eventName of this._activityEvents) {
      this._document.addEventListener(eventName, this._onActivityBound, { passive: true });
    }
    this._activityListenersAttached = true;
  }

  private _detachActivityListeners(): void {
    if (!this._activityListenersAttached) return;
    for (const eventName of this._activityEvents) {
      this._document.removeEventListener(eventName, this._onActivityBound);
    }
    this._activityListenersAttached = false;
  }

  private _attachBlockedInteractionGuards(): void {
    if (this._blockEventsAttached) return;

    const preventEvents: Array<keyof WindowEventMap> = [
      'click',
      'mousedown',
      'mouseup',
      'touchstart',
      'touchend',
      'contextmenu',
    ];

    for (const eventName of preventEvents) {
      this._document.addEventListener(eventName, this._onBlockedInteractionBound, true);
    }
    this._document.addEventListener('keydown', this._onBlockedKeydownBound, true);
    this._blockEventsAttached = true;
  }

  private _detachBlockedInteractionGuards(): void {
    if (!this._blockEventsAttached) return;

    const preventEvents: Array<keyof WindowEventMap> = [
      'click',
      'mousedown',
      'mouseup',
      'touchstart',
      'touchend',
      'contextmenu',
    ];

    for (const eventName of preventEvents) {
      this._document.removeEventListener(eventName, this._onBlockedInteractionBound, true);
    }
    this._document.removeEventListener('keydown', this._onBlockedKeydownBound, true);
    this._blockEventsAttached = false;
  }

  private _onBlockedInteraction(event: Event): void {
    if (!this._isLocked()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-session-lock-modal]')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private _onBlockedKeydown(event: KeyboardEvent): void {
    if (!this._isLocked()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-session-lock-modal]')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private _clearIdleTimer(): void {
    if (this._idleTimerId !== null) {
      window.clearTimeout(this._idleTimerId);
      this._idleTimerId = null;
    }
  }

  private _resetState(): void {
    this._clearIdleTimer();
    this._detachBlockedInteractionGuards();
    this._persistLockState(false);
    this._isLocked.set(false);
    this._isInitialized.set(false);
    this._isUnlocking.set(false);
    this._lockTimeoutMs.set(null);
  }

  private _persistLockState(locked: boolean): void {
    if (locked) {
      safeSetLocalStorageItem(STORAGE.SESSION_LOCKED, 'true');
      return;
    }
    safeRemoveLocalStorageItem(STORAGE.SESSION_LOCKED);
  }

  private _isLockPersisted(): boolean {
    return safeGetLocalStorageItem(STORAGE.SESSION_LOCKED) === 'true';
  }
  /**
   * Update session lock settings from UI.
   * Call this after changing the toggle or timeout.
   */
  public updateLockSettings(enabled: boolean, timeoutMinutes: number): void {
    if (typeof timeoutMinutes !== 'number' || timeoutMinutes <= 0) {
      console.warn('Invalid session lock timeout');
      return;
    }
    this._featureEnabled = enabled;
    this._lockTimeoutMs.set(timeoutMinutes * 60_000);
    this._isInitialized.set(true);

    if (!enabled) {
      this._clearIdleTimer();
      this._detachActivityListeners();
      return;
    }

    this._attachActivityListeners();
    if (!this._isLocked()) {
      this.resetInactivityTimer();
    }
  }

}

