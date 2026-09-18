import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';
import { ProcessService } from '@app/core/services/process/process.service';
import {
  CreateManualRegistrationRequestResponse,
  CreateProcessResponse,
  ManualRegistrationSubject,
} from '@app/core/models/process/process.model';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';

function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { required: true };
}

@Component({
  selector: 'app-manual-registration-details-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, ProcessNumberPipe],
  templateUrl: './manual-registration-details-modal.component.html',
  styleUrls: ['./manual-registration-details-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualRegistrationDetailsModalComponent {
  private _fb = inject(FormBuilder);
  private _processService = inject(ProcessService);
  private _transloco = inject(TranslocoService);

  readonly draft = input.required<CreateProcessResponse>();
  readonly submitted = output<CreateManualRegistrationRequestResponse>();
  readonly closed = output<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly arrayErrors = signal<{ plaintiffs: string | null; defendants: string | null }>({
    plaintiffs: null,
    defendants: null,
  });

  readonly roles = [
    { value: 'plaintiff', labelKey: 'gestionProcesos.filters.plaintiff' },
    { value: 'defendant', labelKey: 'gestionProcesos.filters.defendant' },
  ];

  readonly form: FormGroup = this._fb.group({
    process_number: [{ value: '', disabled: true }],
    lawyer_role: ['', Validators.required],
    process_class: ['', requiredTrimmed],
    plaintiffs: this._fb.array([this._partyGroup()]),
    defendants: this._fb.array([this._partyGroup()]),
    other_subjects: this._fb.array([]),
  });

  constructor() {
    effect(() => {
      const draft = this.draft();
      this.form.reset();
      this._replaceParties(this.plaintiffs, [this._partyGroup()]);
      this._replaceParties(this.defendants, [this._partyGroup()]);
      this._replaceParties(this.other_subjects, []);
      this.form.patchValue({
        process_number: draft.process_number ?? '',
        lawyer_role: draft.lawyer_role ?? '',
        process_class: '',
      });
    });
  }

  get plaintiffs(): FormArray {
    return this.form.get('plaintiffs') as FormArray;
  }

  get defendants(): FormArray {
    return this.form.get('defendants') as FormArray;
  }

  get other_subjects(): FormArray {
    return this.form.get('other_subjects') as FormArray;
  }

  asGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  addParty(list: FormArray): void {
    list.push(this._partyGroup());
  }

  removeParty(list: FormArray, index: number, min = 0): void {
    if (list.length <= min) return;
    list.removeAt(index);
    if (list === this.plaintiffs) {
      this.arrayErrors.update((errors) => ({ ...errors, plaintiffs: null }));
    }
    if (list === this.defendants) {
      this.arrayErrors.update((errors) => ({ ...errors, defendants: null }));
    }
  }

  fieldError(control: AbstractControl | null, fallbackKey: string): string | null {
    if (!control || !control.invalid || !control.touched) return null;
    if (typeof control.errors?.['api'] === 'string' && control.errors['api']) {
      return control.errors['api'];
    }
    return this._transloco.translate(fallbackKey);
  }

  onClose(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  onSubmit(): void {
    this.error.set(null);
    this.arrayErrors.set({ plaintiffs: null, defendants: null });
    this.form.markAllAsTouched();
    this._clearApiErrors(this.form);

    const rowsValid = this._validateVisibleRows(this.plaintiffs)
      && this._validateVisibleRows(this.defendants)
      && this._validateVisibleRows(this.other_subjects);

    const hasPlaintiff = this._hasValidName(this.plaintiffs);
    const hasDefendant = this._hasValidName(this.defendants);
    this.arrayErrors.set({
      plaintiffs: hasPlaintiff
        ? null
        : this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.plaintiffsMin'),
      defendants: hasDefendant
        ? null
        : this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.defendantsMin'),
    });

    const processClass = String(this.form.get('process_class')?.value ?? '').trim();
    const lawyerRole = String(this.form.get('lawyer_role')?.value ?? '').trim();
    if (!processClass) {
      this.form.get('process_class')?.setErrors({ required: true });
    }
    if (!lawyerRole) {
      this.form.get('lawyer_role')?.setErrors({ required: true });
    }

    if (!rowsValid || !hasPlaintiff || !hasDefendant || !processClass || !lawyerRole || this.form.invalid) {
      return;
    }

    const draft = this.draft();
    const processNumber = draft.process_number?.trim();
    const reason = draft.reason;
    if (!processNumber || !reason) {
      this.error.set(this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.generic'));
      return;
    }

    const otherSubjects = this._collectParties(this.other_subjects);

    this.submitting.set(true);
    this._processService
      .createManualRegistrationRequest({
        process_number: processNumber,
        reason,
        lawyer_role: lawyerRole,
        process_class: processClass,
        plaintiffs: this._collectParties(this.plaintiffs),
        defendants: this._collectParties(this.defendants),
        ...(otherSubjects.length > 0 ? { other_subjects: otherSubjects } : {}),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => this.submitted.emit(response),
        error: (err) => {
          if (err.status === 202 && err.error) {
            this.submitted.emit({
              ...err.error,
              status: err.error.status ?? 'manual_review',
            });
            return;
          }
          this._applyApiErrors(err);
        },
      });
  }

  private _partyGroup(): FormGroup {
    return this._fb.group({
      name: ['', requiredTrimmed],
      identification: [''],
    });
  }

  private _replaceParties(list: FormArray, next: FormGroup[]): void {
    list.clear();
    next.forEach((group) => list.push(group));
  }

  private _hasValidName(list: FormArray): boolean {
    return list.controls.some((control) => this._trimmedName(control).length > 0);
  }

  private _validateVisibleRows(list: FormArray): boolean {
    let valid = true;
    list.controls.forEach((control) => {
      const nameCtrl = (control as FormGroup).get('name');
      if (!nameCtrl) return;
      nameCtrl.markAsTouched();
      nameCtrl.updateValueAndValidity({ emitEvent: false });
      if (!this._trimmedName(control)) {
        nameCtrl.setErrors({ ...(nameCtrl.errors ?? {}), required: true });
        valid = false;
      }
    });
    return valid;
  }

  private _trimmedName(control: AbstractControl): string {
    return String((control as FormGroup).get('name')?.value ?? '').trim();
  }

  private _collectParties(list: FormArray): ManualRegistrationSubject[] {
    return list.controls
      .map((control) => {
        const value = (control as FormGroup).getRawValue() as ManualRegistrationSubject;
        const name = value.name?.trim() ?? '';
        const identification = value.identification?.trim();
        const party: ManualRegistrationSubject = { name };
        if (identification) party.identification = identification;
        return party;
      })
      .filter((party) => party.name.length > 0);
  }

  private _clearApiErrors(control: AbstractControl): void {
    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.values(control.controls).forEach((child) => this._clearApiErrors(child));
    }
    const errors = control.errors;
    if (!errors?.['api']) return;
    const { api: _api, ...rest } = errors;
    control.setErrors(Object.keys(rest).length ? rest : null);
  }

  private _applyApiErrors(err: {
    error?: { message?: string; messages?: string[]; errors?: Record<string, string[] | string> };
  }): void {
    const body = err.error;
    const fieldErrors = body?.errors ?? {};
    const leftover: string[] = [];

    for (const [key, raw] of Object.entries(fieldErrors)) {
      const message = Array.isArray(raw) ? raw.filter(Boolean).join('. ') : String(raw ?? '');
      if (!message) continue;

      const nested = key.match(/^(plaintiffs|defendants|other_subjects)\.(\d+)\.(\w+)$/);
      if (nested) {
        const [, arrayName, index, field] = nested;
        const group = (this.form.get(arrayName) as FormArray | null)?.at(Number(index)) as FormGroup | undefined;
        const ctrl = group?.get(field);
        if (ctrl) {
          ctrl.setErrors({ ...(ctrl.errors ?? {}), api: message });
          ctrl.markAsTouched();
          continue;
        }
      }

      if (key === 'plaintiffs' || key === 'defendants') {
        this.arrayErrors.update((current) => ({ ...current, [key]: message }));
        continue;
      }

      const ctrl = this.form.get(key);
      if (ctrl) {
        ctrl.setErrors({ ...(ctrl.errors ?? {}), api: message });
        ctrl.markAsTouched();
        continue;
      }

      leftover.push(message);
    }

    if (body?.messages && Array.isArray(body.messages)) {
      leftover.push(...body.messages.filter(Boolean));
    } else if (!Object.keys(fieldErrors).length && body?.message) {
      leftover.push(body.message);
    }

    this.error.set(
      leftover.length
        ? leftover.join('. ')
        : Object.keys(fieldErrors).length
          ? null
          : this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.generic')
    );
  }
}
