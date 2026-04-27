import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
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

  public unlockForm = this._formBuilder.group({
    password: ['', [Validators.required]],
  });

  public readonly isSubmitting = this._sessionLockService.isUnlocking;
  public readonly errorMessage = signal<string | null>(null);
  public readonly globalMessage = signal<string | null>(null);
  public readonly rateLimitUntil = signal<number | null>(null);
  public readonly rateLimitSeconds = signal(0);
  public readonly isLocked = this._sessionLockService.isLocked;

  public readonly isRateLimited = computed(() => this.rateLimitSeconds() > 0);
  async unlockSession(): Promise<void> {
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
    } catch (error: any) {
      const status = error?.status;

      if (status === 422) {
        const validationMessage = error?.error?.errors?.password?.[0];
        this.errorMessage.set(validationMessage || 'La contraseña es incorrecta.');
        return;
      }

      if (status === 401) {
        await this._sessionLockService.logoutAndRedirectToSignIn();
        return;
      }

      if (status === 429) {
        const message429 = error?.error?.messages?.[0] || error?.error?.message;
        this.globalMessage.set(message429 || 'Demasiados intentos. Por favor, inténtalo más tarde.');
        this._startRateLimitCooldown();
        return;
      }

      const genericMessage = error?.error?.messages?.[0] || error?.error?.message;
      this.globalMessage.set(genericMessage || 'No fue posible desbloquear la sesión.');
    }
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
