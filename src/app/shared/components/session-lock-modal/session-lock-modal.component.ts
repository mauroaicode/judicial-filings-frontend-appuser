import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@app/core/auth/auth.service';
import { SessionUnlockMethod } from '@app/core/models/auth/auth.model';
import { SessionLockService } from '@app/core/services/session-lock/session-lock.service';

@Component({
  selector: 'app-session-lock-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './session-lock-modal.component.html',
  styleUrls: ['./session-lock-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionLockModalComponent {
  private _formBuilder = inject(FormBuilder);
  private _sessionLockService = inject(SessionLockService);
  private _authService = inject(AuthService);
  private _transloco = inject(TranslocoService);
  private _wasLocked = false;

  public unlockForm = this._formBuilder.group({
    password: ['', [Validators.required]],
  });

  public otpForm = this._formBuilder.group({
    one_time_password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
  });

  public readonly activeMethod = signal<SessionUnlockMethod>('password');
  public readonly otpDigits = signal('');

  public readonly isSubmitting = this._sessionLockService.isUnlocking;
  public readonly errorMessage = signal<string | null>(null);
  public readonly globalMessage = signal<string | null>(null);
  public readonly rateLimitUntil = signal<number | null>(null);
  public readonly rateLimitSeconds = signal(0);
  public readonly isLocked = this._sessionLockService.isLocked;
  public readonly showPassword = signal(false);

  public readonly isRateLimited = computed(() => this.rateLimitSeconds() > 0);

  constructor() {
    effect(() => {
      const locked = this.isLocked();
      if (locked && !this._wasLocked) {
        const method = this._authService.user()?.session_unlock_method === 'otp' ? 'otp' : 'password';
        this.activeMethod.set(method);
        this.unlockForm.reset();
        this.otpForm.reset();
        this.otpDigits.set('');
        this.errorMessage.set(null);
        this.globalMessage.set(null);
      }
      this._wasLocked = locked;
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  async signOut(): Promise<void> {
    await this._sessionLockService.logoutAndRedirectToSignIn();
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    this.otpForm.get('one_time_password')?.setValue(digits);
    this.otpDigits.set(digits);
    input.value = digits;
  }

  async unlockWithOtp(): Promise<void> {
    if (this.otpForm.invalid || this.isRateLimited()) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.globalMessage.set(null);
    const code = String(this.otpForm.value.one_time_password ?? '');

    try {
      await this._sessionLockService.verifyOtpAndUnlock(code);
      this.otpForm.reset();
    } catch (error: unknown) {
      this._handleUnlockError(error, true);
    }
  }

  async unlockSession(): Promise<void> {
    if (this.isRateLimited()) return;
    if (this.unlockForm.invalid) {
      this.unlockForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.globalMessage.set(null);

    const password = this.unlockForm.get('password')?.value?.trim() ?? '';
    if (!password) {
      this.unlockForm.get('password')?.setErrors({ required: true });
      return;
    }

    try {
      await this._sessionLockService.verifyPasswordAndUnlock(password);
      this.unlockForm.reset();
    } catch (error: unknown) {
      this._handleUnlockError(error, false);
    }
  }

  private async _handleUnlockError(error: unknown, clearCode: boolean): Promise<void> {
    const status = (error as { status?: number })?.status;
    const body = (error as { error?: { messages?: string[]; errors?: Record<string, string[]> } })?.error;
    const message = body?.messages?.[0]
      || body?.errors?.['password']?.[0]
      || body?.errors?.['one_time_password']?.[0]
      || '';

    if (status === 401) {
      await this._sessionLockService.logoutAndRedirectToSignIn();
      return;
    }

    if (status === 429) {
      this.globalMessage.set(message || this._transloco.translate('sessionLock.rateLimited'));
      this._startRateLimitCooldown();
      return;
    }

    if (clearCode && status === 422) {
      this.otpForm.get('one_time_password')?.reset('');
      this.otpDigits.set('');
    }

    if (message) {
      this.errorMessage.set(message);
      return;
    }

    this.globalMessage.set(this._transloco.translate('sessionLock.unlockError'));
  }

  private _startRateLimitCooldown(): void {
    const cooldownMs = 60_000;
    const until = Date.now() + cooldownMs;
    this.rateLimitUntil.set(until);

    const updateRemaining = (): void => {
      const remainingMs = Math.max(until - Date.now(), 0);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      this.rateLimitSeconds.set(remainingSeconds);

      if (remainingMs <= 0) {
        this.rateLimitUntil.set(null);
        this.globalMessage.set(null);
        return;
      }

      window.setTimeout(updateRemaining, 1_000);
    };

    updateRemaining();
  }
}
