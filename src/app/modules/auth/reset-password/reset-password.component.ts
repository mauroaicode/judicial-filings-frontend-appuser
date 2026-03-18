import {
  ChangeDetectionStrategy,
  Component,
  inject,
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SecurityTipsPanelComponent } from '@app/shared/components/security-tips-panel/security-tips-panel.component';
import { TitleSystemAuth } from '@app/shared/components/title-system-auth/title-system-auth';
import { AlertComponent } from '@app/shared/components/alert/alert.component';
import { AuthService } from '@app/core/auth/auth.service';
import { ErrorHandlerService } from '@app/core/services/error/error-handler.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoPipe, SecurityTipsPanelComponent, TitleSystemAuth, AlertComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);
  private _formBuilder = inject(FormBuilder);
  private _authService = inject(AuthService);
  private _errorHandler = inject(ErrorHandlerService);

  public resetPasswordForm!: FormGroup;
  public isLoading = signal<boolean>(false);
  public showAlert = signal<boolean>(false);
  public alertMessage = signal<string>('');
  public alertType = signal<'success' | 'error'>('error');
  public isSuccess = signal<boolean>(false);
  public showPassword = signal<boolean>(false);
  public showConfirmPassword = signal<boolean>(false);
  public currentYear = new Date().getFullYear();
  private _isDirectMessage = signal<boolean>(false);
  
  private _token: string | null = null;
  private _encodedId: string | null = null;
  private _identification: string | null = null;

  ngOnInit(): void {
    // Get query params
    this._token = this._activatedRoute.snapshot.queryParamMap.get('token');
    this._encodedId = this._activatedRoute.snapshot.queryParamMap.get('id');

    if (!this._token || !this._encodedId) {
      this.alertType.set('error');
      this.alertMessage.set('auth.forgotPassword.invalidCode');
      this.showAlert.set(true);
    }

    // Decode ID (Base64)
    if (this._encodedId) {
      try {
        this._identification = atob(this._encodedId);
      } catch (e) {
        console.error('Error decoding ID:', e);
        this.alertType.set('error');
        this.alertMessage.set('auth.forgotPassword.invalidCode');
        this.showAlert.set(true);
      }
    }

    this.resetPasswordForm = this._formBuilder.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    }, {
      validators: this._passwordsMatchValidator
    });
  }

  /**
   * Submit reset password form
   */
  async submitResetPassword(): Promise<void> {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    if (!this._token || !this._identification) {
       this.alertType.set('error');
       this.alertMessage.set('auth.forgotPassword.invalidCode');
       this.showAlert.set(true);
       return;
    }

    this.isLoading.set(true);
    this.showAlert.set(false);

    try {
      const { password, confirmPassword } = this.resetPasswordForm.value;

      await firstValueFrom(
        this._authService.resetPassword({
          identification: this._identification,
          token: this._token,
          password,
          password_confirmation: confirmPassword
        })
      );

      this.isSuccess.set(true);
      this.alertType.set('success');
      this.alertMessage.set('auth.forgotPassword.passwordReset');
      this._isDirectMessage.set(false);
      this.showAlert.set(true);

      // Redirect to sign-in after 3 seconds
      setTimeout(() => {
        this._router.navigate(['/sign-in']);
      }, 3000);

    } catch (error: any) {
      this.alertType.set('error');
      const errorMessage = this._errorHandler.getErrorMessage(error, true);

      if (errorMessage) {
        this.alertMessage.set(errorMessage);
        this._isDirectMessage.set(true);
        this.showAlert.set(true);
      } else {
        this.alertMessage.set('auth.errors.somethingWentWrong');
        this._isDirectMessage.set(false);
        this.showAlert.set(true);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Validator to check if passwords match
   */
  private _passwordsMatchValidator(form: FormGroup): null {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordsNotMatch: true });
    } else if (confirmPassword) {
      const errors = confirmPassword.errors;
      if (errors) {
        delete errors['passwordsNotMatch'];
        if (Object.keys(errors).length === 0) {
          confirmPassword.setErrors(null);
        } else {
          confirmPassword.setErrors(errors);
        }
      }
    }
    return null;
  }

  /**
   * Check if a form field is invalid
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.resetPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Check if current alert message is a direct message (not a translation key)
   */
  public isDirectMessage(): boolean {
    return this._isDirectMessage();
  }

  /**
   * Get error message for a field
   */
  getFieldError(fieldName: string): string {
    const field = this.resetPasswordForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'auth.errors.fieldRequired';
    }
    if (field?.hasError('minlength')) {
      return 'auth.errors.passwordMinLength';
    }
    if (field?.hasError('passwordsNotMatch')) {
      return 'auth.forgotPassword.passwordsNotMatch';
    }
    return '';
  }
}
