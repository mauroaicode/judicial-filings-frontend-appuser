import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ProfileService } from '@app/core/services/user/profile.service';
import { ProfileUpdateRequest, User } from '@app/core/models/auth/auth.model';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, TranslocoModule, FormsModule, ReactiveFormsModule],
    templateUrl: './profile.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
    private _profileService = inject(ProfileService);
    private _fb = inject(FormBuilder);
    private _transloco = inject(TranslocoService);
    private _authService = inject(AuthService);

    public profileForm: FormGroup;
    public isLoading = signal<boolean>(false);
    public isSaving = signal<boolean>(false);
    public feedbackMessage = signal<string | null>(null);
    public feedbackType = signal<'success' | 'error'>('success');
    
    public currentUser = this._authService.user;

    constructor() {
        this.profileForm = this._fb.group({
            name: ['', [Validators.required]],
            last_name: ['', [Validators.required]],
            email: ['', [Validators.required, Validators.email]],
            identification: ['', [Validators.required]],
            password: [''],
            password_confirmation: ['']
        }, {
            validators: this._passwordMatchValidator
        });
    }

    ngOnInit(): void {
        this.loadProfile();
    }

    loadProfile(): void {
        this.isLoading.set(true);
        this._profileService.getProfile().pipe(
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (user) => {
                this.profileForm.patchValue({
                    name: user.name,
                    last_name: user.last_name,
                    email: user.email,
                    identification: user.identification
                });
            },
            error: () => this._showFeedback('profile.messages.errorLoading', 'error')
        });
    }

    updateProfile(): void {
        if (this.profileForm.invalid) {
            this.profileForm.markAllAsTouched();
            return;
        }

        const formValue = this.profileForm.value;
        const updateData: ProfileUpdateRequest = {
            name: formValue.name,
            last_name: formValue.last_name,
            email: formValue.email,
            identification: formValue.identification
        };

        if (formValue.password) {
            updateData.password = formValue.password;
            updateData.password_confirmation = formValue.password_confirmation;
        }

        this.isSaving.set(true);
        this._profileService.updateProfile(updateData).pipe(
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (updatedUser) => {
                this._authService.currentUser = updatedUser; // Update local state
                this._showFeedback('profile.messages.updated', 'success');
                this.profileForm.get('password')?.reset();
                this.profileForm.get('password_confirmation')?.reset();
            },
            error: () => this._showFeedback('profile.messages.errorUpdating', 'error')
        });
    }

    private _passwordMatchValidator(form: any) {
        const password = form.get('password')?.value;
        const confirm = form.get('password_confirmation')?.value;

        if (password && password !== confirm) {
            form.get('password_confirmation')?.setErrors({ mismatch: true });
            return { mismatch: true };
        }
        return null;
    }

    private _showFeedback(key: string, type: 'success' | 'error'): void {
        this.feedbackMessage.set(this._transloco.translate(key));
        this.feedbackType.set(type);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
    }
}
