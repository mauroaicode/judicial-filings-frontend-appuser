import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';
import { STORAGE } from '@app/core/constants/storage.constant';

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

  initializeFromCurrentUser(): void {
    if (this._isInitialized()) return;

    const timeoutMinutes = this._authService.currentUser?.session_lock_timeout;

    if (typeof timeoutMinutes !== 'number' || !Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
      this.forceLogoutForMissingLockTimeout();
      return;
    }

    this._lockTimeoutMs.set(timeoutMinutes * 60_000);
    this._isInitialized.set(true);
    this._attachActivityListeners();

    if (this._isLockPersisted()) {
      this.lock();
      return;
    }

    this.resetInactivityTimer();
  }

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
    this.resetInactivityTimer();
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
    for (const eventName of this._activityEvents) {
      this._document.addEventListener(eventName, this._onActivityBound, { passive: true });
    }
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
      localStorage.setItem(STORAGE.SESSION_LOCKED, 'true');
      return;
    }
    localStorage.removeItem(STORAGE.SESSION_LOCKED);
  }

  private _isLockPersisted(): boolean {
    return localStorage.getItem(STORAGE.SESSION_LOCKED) === 'true';
  }
}
