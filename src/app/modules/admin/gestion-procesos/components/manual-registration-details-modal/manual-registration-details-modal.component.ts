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

  readonly roles = [
    { value: 'plaintiff', labelKey: 'gestionProcesos.filters.plaintiff' },
    { value: 'defendant', labelKey: 'gestionProcesos.filters.defendant' },
  ];

  readonly form: FormGroup = this._fb.group({
    process_number: [{ value: '', disabled: true }],
    lawyer_role: ['', Validators.required],
    process_class: ['', Validators.required],
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
    list.push(this._partyGroup(list !== this.other_subjects));
  }

  removeParty(list: FormArray, index: number, min = 0): void {
    if (list.length <= min) return;
    list.removeAt(index);
  }

  onClose(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  onSubmit(): void {
    this.error.set(null);
    this.form.markAllAsTouched();

    const plaintiffs = this._collectParties(this.plaintiffs);
    const defendants = this._collectParties(this.defendants);
    const processClass = String(this.form.get('process_class')?.value ?? '').trim();
    const lawyerRole = String(this.form.get('lawyer_role')?.value ?? '').trim();

    if (!processClass || !lawyerRole || plaintiffs.length < 1 || defendants.length < 1) {
      if (plaintiffs.length < 1) {
        this.error.set(this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.plaintiffsMin'));
      } else if (defendants.length < 1) {
        this.error.set(this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.defendantsMin'));
      }
      return;
    }

    if (this.form.invalid) return;

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
        plaintiffs,
        defendants,
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
          this.error.set(this._formatApiError(err));
        },
      });
  }

  private _partyGroup(nameRequired = true): FormGroup {
    return this._fb.group({
      name: ['', nameRequired ? Validators.required : []],
      identification: [''],
    });
  }

  private _replaceParties(list: FormArray, next: FormGroup[]): void {
    list.clear();
    next.forEach((group) => list.push(group));
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

  private _formatApiError(err: { error?: { message?: string; messages?: string[]; errors?: Record<string, string[] | string> } }): string {
    const body = err.error;
    if (body?.messages && Array.isArray(body.messages)) {
      return body.messages.join('. ');
    }
    if (body?.errors) {
      const all = Object.values(body.errors).flat();
      if (all.length) return all.join('. ');
    }
    return body?.message?.trim()
      || this._transloco.translate('gestionProcesos.manualRegistrationDetails.errors.generic');
  }
}
