import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';
import { toQrImageSrc } from '@app/core/auth/two-factor.util';
import { environment } from '@app/core/config/environment.config';
import { TwoFactorSetupResponse, User } from '@app/core/models/auth/auth.model';
import { ErrorHandlerService } from '@app/core/services/error/error-handler.service';
import { ProfileService } from '@app/core/services/user/profile.service';

@Component({
  selector: 'app-two-factor-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './two-factor-settings.component.html',
  styleUrls: ['./two-factor-settings.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorSettingsComponent implements OnInit {
  private _authService = inject(AuthService);
  private _profileService = inject(ProfileService);
  private _errorHandler = inject(ErrorHandlerService);
  private _transloco = inject(TranslocoService);
  private _formBuilder = inject(FormBuilder);
  private _destroyRef = inject(DestroyRef);

  public readonly appName = environment.systemName;
  public readonly enabled = computed(() => this._authService.user()?.google_2fa_enabled === true);
  public readonly email = computed(() => this._authService.user()?.email ?? '');

  public isRefreshing = signal(true);
  public isGenerating = signal(false);
  public isVerifying = signal(false);
  public isDisabling = signal(false);
  public confirmReplace = signal(false);
  public confirmDisable = signal(false);
  public copied = signal(false);
  public setup = signal<TwoFactorSetupResponse | null>(null);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public codeForm = this._formBuilder.group({
    one_time_password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
  });

  public qrImageSrc = computed(() => {
    const svg = this.setup()?.qr_code_svg;
    return svg ? toQrImageSrc(svg) : '';
  });

  ngOnInit(): void {
    this._profileService.getProfile().pipe(
      finalize(() => this.isRefreshing.set(false)),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      next: (user) => this._applyProfile(user),
      error: () => {
        // Keep the flag stored at login if the profile request fails.
      },
    });
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    this.codeForm.get('one_time_password')?.setValue(digits);
    input.value = digits;
  }

  startSetup(): void {
    if (this.enabled() || this.isGenerating() || this.setup()) return;
    this._generate();
  }

  confirmReplaceDevice(): void {
    this.confirmDisable.set(false);
    this.confirmReplace.set(true);
  }

  replaceDevice(): void {
    if (this.isGenerating() || this.setup()) return;
    this.confirmReplace.set(false);
    this._generate();
  }

  cancelSetup(): void {
    this.setup.set(null);
    this.codeForm.reset();
    this.confirmReplace.set(false);
    this.errorMessage.set(null);
  }

  verifyCode(): void {
    if (this.codeForm.invalid || this.isVerifying()) {
      this.codeForm.markAllAsTouched();
      return;
    }

    const code = String(this.codeForm.value.one_time_password ?? '');
    this.isVerifying.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this._authService.verifyTwoFactor(code).pipe(
      finalize(() => this.isVerifying.set(false)),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      next: (response) => {
        this._authService.replaceAccessToken(response.token);
        this._authService.updateCurrentUser({ google_2fa_enabled: true });
        this.setup.set(null);
        this.codeForm.reset();
        this.successMessage.set(this._transloco.translate('twoFactor.enabledSuccess'));
        this._refreshProfile();
      },
      error: (error: unknown) => {
        this._showRequestError(error);
        const status = (error as { status?: number })?.status;
        if (status === 422) {
          this.codeForm.get('one_time_password')?.reset('');
        }
      },
    });
  }

  askDisable(): void {
    this.confirmReplace.set(false);
    this.confirmDisable.set(true);
  }

  disable(): void {
    if (this.isDisabling()) return;

    this.isDisabling.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this._authService.disableTwoFactor().pipe(
      finalize(() => this.isDisabling.set(false)),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      next: (response) => {
        this._authService.replaceAccessToken(response.token);
        this._authService.updateCurrentUser({
          google_2fa_enabled: false,
          session_unlock_method: 'password',
        });
        this.confirmDisable.set(false);
        this.setup.set(null);
        this.successMessage.set(this._transloco.translate('twoFactor.disabledSuccess'));
        this._refreshProfile();
      },
      error: (error: unknown) => {
        this.confirmDisable.set(false);
        this._showRequestError(error);
      },
    });
  }

  async copySecret(): Promise<void> {
    const secret = this.setup()?.secret;
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }

  isCodeInvalid(): boolean {
    const field = this.codeForm.get('one_time_password');
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  private _generate(): void {
    this.isGenerating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this._authService.generateTwoFactor().pipe(
      finalize(() => this.isGenerating.set(false)),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      next: (setup) => {
        this._authService.updateCurrentUser({
          google_2fa_enabled: false,
          session_unlock_method: 'password',
        });
        this.setup.set(setup);
        this.codeForm.reset();
        this._refreshProfile();
      },
      error: (error: unknown) => this._showRequestError(error),
    });
  }

  private _refreshProfile(): void {
    this._profileService.getProfile().pipe(
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      next: (user) => this._applyProfile(user),
    });
  }

  private _applyProfile(user: User): void {
    this._authService.updateCurrentUser({
      google_2fa_enabled: user.google_2fa_enabled === true,
      session_unlock_method: user.session_unlock_method === 'otp' ? 'otp' : 'password',
      session_lock_enabled: user.session_lock_enabled,
      session_lock_timeout: user.session_lock_timeout,
    });
  }

  private _showRequestError(error: unknown): void {
    this.errorMessage.set(
      this._errorHandler.getErrorMessage(error, true) || this._transloco.translate('twoFactor.genericError')
    );
  }
}
