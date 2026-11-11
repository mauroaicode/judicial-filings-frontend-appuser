import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@app/core/auth/auth.service';
import { ConfigService } from '@app/core/services/config/config.service';
import { SessionLockService } from '@app/core/services/session-lock/session-lock.service';
import { SessionUnlockMethod, User } from '@app/core/models/auth/auth.model';
import { TwoFactorSettingsComponent } from '@app/shared/components/two-factor-settings/two-factor-settings.component';
import { ErrorHandlerService } from '@app/core/services/error/error-handler.service';

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslocoPipe, TwoFactorSettingsComponent],
  templateUrl: './security-settings.component.html',
})
export class SecuritySettingsComponent {
  private _authService = inject(AuthService);
  private _configService = inject(ConfigService);
  private _sessionLockService = inject(SessionLockService);
  private _errorHandler = inject(ErrorHandlerService);
  private _fb = inject(FormBuilder);

  readonly user = this._authService.user;
  readonly twoFactorEnabled = computed(() => this.user()?.google_2fa_enabled === true);

  securityForm: FormGroup = this._fb.group({
    session_lock_enabled: [this._authService.currentUser?.session_lock_enabled !== false],
    session_lock_timeout: [this._authService.currentUser?.session_lock_timeout || 5, [Validators.required, Validators.min(1), Validators.max(120)]],
    session_unlock_method: [this._initialUnlockMethod()],
  });

  constructor() {
    this.securityForm.get('session_unlock_method')?.valueChanges.subscribe((value) => {
      if (value === 'otp' && !this.twoFactorEnabled()) {
        this.securityForm.get('session_unlock_method')?.setValue('password', { emitEvent: false });
      }
    });

    effect(() => {
      const current = this.user();
      const twoFactorOn = current?.google_2fa_enabled === true;
      const storedMethod: SessionUnlockMethod = current?.session_unlock_method === 'otp' && twoFactorOn ? 'otp' : 'password';
      const methodControl = this.securityForm.get('session_unlock_method');
      const enabledControl = this.securityForm.get('session_lock_enabled');
      const timeoutControl = this.securityForm.get('session_lock_timeout');

      if (!twoFactorOn) {
        if (methodControl?.value !== 'password') {
          methodControl?.setValue('password', { emitEvent: false });
          methodControl?.markAsPristine();
        }
      } else if (methodControl?.pristine) {
        methodControl.setValue(storedMethod, { emitEvent: false });
        methodControl.markAsPristine();
      }

      if (enabledControl?.pristine) {
        enabledControl.setValue(current?.session_lock_enabled !== false, { emitEvent: false });
        enabledControl.markAsPristine();
      }

      if (timeoutControl?.pristine) {
        timeoutControl.setValue(current?.session_lock_timeout || 5, { emitEvent: false });
        timeoutControl.markAsPristine();
      }
    });
  }

  isSaving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  saveSettings() {
    if (this.securityForm.invalid) {
      this.securityForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const twoFactorOn = this.twoFactorEnabled();
    const selectedMethod = this.securityForm.value.session_unlock_method === 'otp' ? 'otp' : 'password';
    const unlockMethod: SessionUnlockMethod = selectedMethod === 'otp' && twoFactorOn ? 'otp' : 'password';

    const payload = {
      session_lock_enabled: this.securityForm.value.session_lock_enabled,
      session_lock_timeout: Number(this.securityForm.value.session_lock_timeout),
      session_unlock_method: unlockMethod,
    };

    this._configService.updateSessionLock(payload).subscribe({
      next: (updatedUser: User) => {
        this.isSaving.set(false);
        this.successMessage.set('securitySettings.saveSuccess');

        this._authService.updateCurrentUser({
          session_lock_enabled: updatedUser.session_lock_enabled,
          session_lock_timeout: updatedUser.session_lock_timeout,
          session_unlock_method: updatedUser.session_unlock_method === 'otp' ? 'otp' : 'password',
          google_2fa_enabled: updatedUser.google_2fa_enabled === true,
        });
        this.securityForm.markAsPristine();

        this._sessionLockService.updateLockSettings(
          updatedUser.session_lock_enabled ?? false,
          updatedUser.session_lock_timeout || 5
        );

        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        const fieldMessage = err?.error?.errors?.session_unlock_method?.[0];
        this.errorMessage.set(fieldMessage || this._errorHandler.getErrorMessage(err, true) || 'securitySettings.saveError');
      }
    });
  }

  private _initialUnlockMethod(): SessionUnlockMethod {
    const current = this._authService.currentUser;
    if (current?.google_2fa_enabled && current.session_unlock_method === 'otp') {
      return 'otp';
    }
    return 'password';
  }
}
