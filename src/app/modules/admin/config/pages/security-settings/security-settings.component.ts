import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslocoDirective, TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@app/core/auth/auth.service';
import { ConfigService } from '@app/core/services/config/config.service';
import { SessionLockService } from '@app/core/services/session-lock/session-lock.service';
import { User } from '@app/core/models/auth/auth.model';

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './security-settings.component.html',
})
export class SecuritySettingsComponent {
  private _authService = inject(AuthService);
  private _configService = inject(ConfigService);
  private _sessionLockService = inject(SessionLockService);
  private _fb = inject(FormBuilder);

  user = this._authService.currentUser;
  
  securityForm: FormGroup = this._fb.group({
    session_lock_enabled: [this.user?.session_lock_enabled !== false],
    session_lock_timeout: [this.user?.session_lock_timeout || 5, [Validators.required, Validators.min(1), Validators.max(120)]]
  });

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

    const payload = {
      session_lock_enabled: this.securityForm.value.session_lock_enabled,
      session_lock_timeout: this.securityForm.value.session_lock_timeout,
    };

    this._configService.updateSessionLock(payload).subscribe({
      next: (updatedUser: User) => {
        this.isSaving.set(false);
        this.successMessage.set('Configuración guardada correctamente.');
        
        if (this._authService.currentUser) {
          this._authService.currentUser = {
            ...this._authService.currentUser,
            session_lock_enabled: updatedUser.session_lock_enabled,
            session_lock_timeout: updatedUser.session_lock_timeout
          };
        }

        this._sessionLockService.updateLockSettings(
          updatedUser.session_lock_enabled ?? false, 
          updatedUser.session_lock_timeout || 5
        );

        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.message || 'Error al guardar la configuración.');
      }
    });
  }
}
