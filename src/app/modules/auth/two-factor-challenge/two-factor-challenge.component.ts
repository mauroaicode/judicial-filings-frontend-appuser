import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SecurityTipsPanelComponent } from '@app/shared/components/security-tips-panel/security-tips-panel.component';
import { TitleSystemAuth } from '@app/shared/components/title-system-auth/title-system-auth';
import { AlertComponent } from '@app/shared/components/alert/alert.component';
import { AuthService } from '@app/core/auth/auth.service';
import { ROLE_ROUTE_MAP, ROUTES_ADMIN } from '@app/core/constants/router.constant';
import type { RoleName } from '@app/core/constants/router.constant';
import { ErrorHandlerService } from '@app/core/services/error/error-handler.service';
import { ThemeService } from '@app/core/services/theme/theme.service';

@Component({
  selector: 'app-two-factor-challenge',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, SecurityTipsPanelComponent, TitleSystemAuth, AlertComponent],
  templateUrl: './two-factor-challenge.component.html',
  styleUrls: ['./two-factor-challenge.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorChallengeComponent implements OnInit, OnDestroy {
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);
  private _formBuilder = inject(FormBuilder);
  private _authService = inject(AuthService);
  private _errorHandler = inject(ErrorHandlerService);
  private _themeService = inject(ThemeService);

  public codeForm!: FormGroup;
  public isLoading = signal(false);
  public showAlert = signal(false);
  public alertMessage = signal('');
  public alertType = signal<'success' | 'error'>('error');
  public currentYear = new Date().getFullYear();
  private _returnUrl = signal<string | null>(null);

  ngOnInit(): void {
    this._themeService.lockAuthLight();
    this._returnUrl.set(this._safeReturnUrl(this._activatedRoute.snapshot.queryParamMap.get('returnUrl')));
    this.codeForm = this._formBuilder.group({
      one_time_password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnDestroy(): void {
    this._themeService.unlockAuthLight();
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    this.codeForm.get('one_time_password')?.setValue(digits);
    input.value = digits;
  }

  async submitCode(): Promise<void> {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.showAlert.set(false);

    try {
      const code = String(this.codeForm.value.one_time_password ?? '');
      const response = await firstValueFrom(this._authService.validateTwoFactor(code));
      this._authService.replaceAccessToken(response.token);
      await this._enterApp();
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      const errorMessage = this._errorHandler.getErrorMessage(error, true);
      this.alertType.set('error');
      this.alertMessage.set(errorMessage || 'auth.errors.somethingWentWrong');
      this.showAlert.set(true);

      if (status === 422) {
        this.codeForm.get('one_time_password')?.reset('');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async backToSignIn(): Promise<void> {
    await firstValueFrom(this._authService.signOut());
    await this._router.navigate([ROUTES_ADMIN.SIGN_IN]);
  }

  isFieldInvalid(): boolean {
    const field = this.codeForm.get('one_time_password');
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  private async _enterApp(): Promise<void> {
    const user = this._authService.currentUser;

    if (user?.must_change_password) {
      await this._router.navigate(['/perfil']);
      return;
    }

    const returnUrl = this._returnUrl();
    if (returnUrl) {
      await this._router.navigateByUrl(returnUrl);
      return;
    }

    for (const role of user?.roles ?? []) {
      const route = ROLE_ROUTE_MAP[role.value as RoleName];
      if (route) {
        await this._router.navigate([route]);
        return;
      }
    }

    await this._router.navigate([ROUTES_ADMIN.GESTION_PROCESOS]);
  }

  private _safeReturnUrl(value: string | null): string | null {
    if (!value) return null;
    if (!value.startsWith('/')) return null;
    if (value.startsWith('//')) return null;
    if (value.startsWith(ROUTES_ADMIN.TWO_FACTOR_CHALLENGE)) return null;
    return value;
  }
}
