import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HttpErrorResponse } from '@angular/common/http';
import { TaskService } from '@app/core/services/task/task.service';
import {
    Task,
    ProcessSummary,
    TaskCreateRequest,
    TaskStatusOption,
    TaskStatus,
    TaskType,
    TaskUpdateRequest,
    TASK_TYPE_OPTIONS,
} from '@app/core/models/tasks/task.model';
import { finalize, Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '@app/shared/components/time-picker/time-picker.component';
import { formatApiDateTime } from '@app/core/utils/api-datetime.util';
import {
    formatLocalDateYmd,
    isLocalDateBeforeToday,
    isLocalDateTimeInPast,
    isLocalDateToday,
    nextFiveMinuteSlot,
} from '@app/core/utils/local-datetime.util';
import { ProcessRefreshService } from '@app/core/services/process/process-refresh.service';

@Component({
    selector: 'app-task-form-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslocoModule, ProcessNumberPipe, ConfirmationDialogComponent, DatePickerComponent, TimePickerComponent],
    templateUrl: './task-form-modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormModalComponent implements OnInit, OnDestroy {
    private _fb = inject(FormBuilder);
    private _taskService = inject(TaskService);
    private _authService = inject(AuthService);
    private _transloco = inject(TranslocoService);
    private _processRefresh = inject(ProcessRefreshService);
    private _destroy$ = new Subject<void>();
    private _selectedProcessDisplay = signal<string | null>(null);
    private _originalStatus: TaskStatus = 'pending';

    @ViewChild('processSearchContainer') private _processSearchContainer?: ElementRef<HTMLElement>;

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event): void {
        if (!this.showProcessDropdown()) {
            return;
        }

        const target = event.target as Node;
        if (this._processSearchContainer?.nativeElement.contains(target)) {
            return;
        }

        this._closeProcessDropdown();
    }

    // Inputs/Outputs
    public task = input<Task | null>(null);
    /** Prefill process when opening create form from process detail / deep link. */
    public initialProcessId = input<string | null>(null);
    public initialProcessNumber = input<string | null>(null);
    public closed = output<void>();
    public saved = output<void>();
    public openSuspensionGuide = output<void>();

    // State
    public taskForm: FormGroup;
    public isSaving = signal(false);
    public showConfirmDialog = signal(false);
    public isSearchingProcesses = signal(false);
    public processes = signal<ProcessSummary[]>([]);
    public showProcessDropdown = signal(false);
    public taskStatuses = signal<TaskStatusOption[]>([]);
    public readonly taskTypes = TASK_TYPE_OPTIONS;

    /** Field-level Laravel validation errors (422). */
    public backendErrors = signal<Record<string, string[]>>({});
    /** Top-level form alert (422 message or generic save error). */
    public formError = signal<string | null>(null);
    /** Mirrors due_date for derived minTime (today → next available slot). */
    public dueDateValue = signal<string | null>(null);

    public readonly minDueDate = formatLocalDateYmd();
    public readonly minDueTime = computed(() => {
        const date = this.dueDateValue();
        if (!date || !isLocalDateToday(date)) {
            return null;
        }
        return nextFiveMinuteSlot();
    });

    constructor() {
        this.taskForm = this._fb.group({
            title: ['', [Validators.required, Validators.maxLength(255)]],
            description: ['', [Validators.required]],
            type: ['general' as TaskType, [Validators.required]],
            due_date: [null as string | null, [this._dueDateNotPastValidator]],
            due_time: [null as string | null],
            reminder_days: [null as number | null, [Validators.min(0), Validators.max(365)]],
            status: ['pending', [Validators.required]],
            process_id: [null],
            process_search: [''] // Temporary field for searching
        });

        this.taskForm.get('due_time')?.setValidators([this._dueTimeNotPastValidator()]);
    }

    ngOnInit(): void {
        this._loadStatuses();

        if (this.task()) {
            const currentTask = this.task()!;
            const formattedProcessNumber = currentTask.process_number
                ? new ProcessNumberPipe().transform(currentTask.process_number)
                : '';
            const dueDateTime = this._splitDueDateTime(currentTask.due_date);

            this._originalStatus = currentTask.status ?? 'pending';

            this.taskForm.patchValue({
                title: currentTask.title,
                description: currentTask.description,
                type: currentTask.type ?? 'general',
                due_date: dueDateTime.date,
                due_time: dueDateTime.time,
                reminder_days: currentTask.reminder_days ?? null,
                status: this._originalStatus,
                process_id: currentTask.process_id,
                process_search: formattedProcessNumber
            });

            this.dueDateValue.set(dueDateTime.date);

            if (currentTask.process_id && formattedProcessNumber) {
                this._selectedProcessDisplay.set(formattedProcessNumber);
            }

            if (this.isStatusOnlyMode()) {
                this._disableEditableFields();
            }
        } else if (this.initialProcessId()) {
            const processId = this.initialProcessId()!;
            const rawNumber = this.initialProcessNumber();
            const formattedProcessNumber = rawNumber
                ? new ProcessNumberPipe().transform(rawNumber)
                : '';

            this.taskForm.patchValue({
                process_id: processId,
                process_search: formattedProcessNumber,
            });

            if (formattedProcessNumber) {
                this._selectedProcessDisplay.set(formattedProcessNumber);
            }
        }

        this._syncProcessValidators(this.taskForm.get('type')?.value);

        this.taskForm.get('type')?.valueChanges.pipe(
            takeUntil(this._destroy$)
        ).subscribe((type: TaskType) => {
            this._syncProcessValidators(type);
            this._clearFieldError('process_id');
            this.formError.set(null);
        });

        this.taskForm.get('due_date')?.valueChanges.pipe(
            takeUntil(this._destroy$)
        ).subscribe((date: string | null) => {
            this.dueDateValue.set(date);
            this._clearFieldError('due_date');
            this._clampPastDueTime(date);
            this.taskForm.get('due_time')?.updateValueAndValidity({ emitEvent: false });
        });

        this.taskForm.get('due_time')?.valueChanges.pipe(
            takeUntil(this._destroy$)
        ).subscribe(() => {
            this._clearFieldError('due_date');
        });

        // Listen to process search changes
        this.taskForm.get('process_search')?.valueChanges.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            takeUntil(this._destroy$)
        ).subscribe(value => {
            if (value && value.length >= 3) {
                this._searchProcesses(value);
            } else {
                this.processes.set([]);
                this.showProcessDropdown.set(false);
            }
        });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    public onSave(): void {
        if (this.isStatusOnlyMode()) {
            if (!this.hasStatusChanged()) {
                return;
            }
            this.showConfirmDialog.set(true);
            return;
        }

        if (this.taskForm.invalid) {
            this.taskForm.markAllAsTouched();
            this.taskForm.get('process_id')?.markAsTouched();
            if (this.isSuspensionType() && !this.taskForm.get('process_id')?.value) {
                this.formError.set(this._transloco.translate('tasks.form.suspensionProcessRequired'));
                this._scrollToProcessField();
            }
            return;
        }

        this.showConfirmDialog.set(true);
    }

    public onConfirmSave(): void {
        this.showConfirmDialog.set(false);
        this.isSaving.set(true);
        this.backendErrors.set({});
        this.formError.set(null);

        const currentTask = this.task();

        if (!currentTask) {
            this._createTask();
            return;
        }

        if (this.isStatusOnlyMode()) {
            this._updateStatusOnly(currentTask);
            return;
        }

        this._updateEditableTask(currentTask);
    }

    public isStatusOnlyMode(): boolean {
        return this.task()?.status === 'completed';
    }

    public isSuspensionType(): boolean {
        return this.taskForm.get('type')?.value === 'suspension';
    }

    public hasStatusChanged(): boolean {
        return this.taskForm.get('status')?.value !== this._originalStatus;
    }

    public canSubmit(): boolean {
        if (this.isSaving()) {
            return false;
        }

        if (this.isStatusOnlyMode()) {
            return this.hasStatusChanged();
        }

        return this.taskForm.valid;
    }

    public onClose(): void {
        this.closed.emit();
    }

    public onProcessSearchFocus(): void {
        this.showProcessDropdown.set(true);
        if (this.processes().length === 0) {
            this._searchProcesses('');
        }
    }

    public selectProcess(process: ProcessSummary): void {
        const formatted = new ProcessNumberPipe().transform(process.number);
        this._selectedProcessDisplay.set(formatted);
        this.taskForm.patchValue({
            process_id: process.id,
            process_search: formatted
        }, { emitEvent: false }); // Don't trigger search again
        this.showProcessDropdown.set(false);
        this._clearFieldError('process_id');
        this.formError.set(null);
        this.taskForm.get('process_id')?.updateValueAndValidity({ emitEvent: false });
    }

    public clearProcess(): void {
        this._selectedProcessDisplay.set(null);
        this.taskForm.patchValue({
            process_id: null,
            process_search: ''
        });
        this._clearFieldError('process_id');
        this.formError.set(null);
        this.taskForm.get('process_id')?.updateValueAndValidity({ emitEvent: false });
        this._searchProcesses(''); // Refresh list
    }

    private _closeProcessDropdown(): void {
        this.showProcessDropdown.set(false);

        const processId = this.taskForm.get('process_id')?.value;
        const selectedDisplay = this._selectedProcessDisplay();
        if (processId && selectedDisplay) {
            this.taskForm.patchValue({ process_search: selectedDisplay }, { emitEvent: false });
        }
    }

    private _resolveOrganizationId(): string | null {
        return this.task()?.organization_id || this._authService.organizationId || null;
    }

    private _loadStatuses(): void {
        this._taskService.getStatuses()
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: (statuses) => this.taskStatuses.set(statuses),
                error: (error) => console.error('Error loading task statuses:', error),
            });
    }

    private _parseReminderDays(value: number | string | null | undefined): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
    }

    /** Splits API datetime into date (Y-m-d) and time (HH:mm) for form controls. */
    private _splitDueDateTime(value: string | null | undefined): { date: string | null; time: string | null } {
        if (!value) {
            return { date: null, time: null };
        }

        const date = value.slice(0, 10);
        const timeMatch = value.match(/(\d{2}):(\d{2})/);

        return {
            date,
            time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : null,
        };
    }

    /** Combines date + time into a single due_date datetime for the API (`Y-m-d H:i:s`). */
    private _combineDueDateTime(
        date: string | null | undefined,
        time: string | null | undefined
    ): string | null {
        if (!date) {
            return null;
        }

        return formatApiDateTime(date, time);
    }

    /** Normalizes API/form datetimes for change comparison. */
    private _normalizeDueDateTime(value: string | null | undefined): string | null {
        if (!value) {
            return null;
        }

        const { date, time } = this._splitDueDateTime(value);
        return this._combineDueDateTime(date, time);
    }

    private _searchProcesses(query: string): void {
        this.isSearchingProcesses.set(true);
        const organizationId = this._resolveOrganizationId();
        if (!organizationId) {
            this.isSearchingProcesses.set(false);
            this.processes.set([]);
            this.showProcessDropdown.set(false);
            return;
        }

        // Clean query: remove special formatting characters
        const cleanQuery = query.replace(/[^0-9a-zA-Z]/g, '').trim();

        // Differentiate filters: purely numeric queries are for process number, others for court/despacho
        const isNumeric = /^\d+$/.test(cleanQuery);
        const processNumber = isNumeric ? cleanQuery : undefined;
        const court = !isNumeric && cleanQuery.length > 0 ? query.trim() : undefined;

        this._taskService.getOrganizationProcesses(organizationId, processNumber, court)
            .pipe(
                finalize(() => this.isSearchingProcesses.set(false)),
                takeUntil(this._destroy$)
            )
            .subscribe({
                next: (results) => {
                    // Remove duplicates by ID
                    const uniqueResults = results.filter((p, index, self) =>
                        index === self.findIndex((t) => t.id === p.id)
                    );
                    this.processes.set(uniqueResults);
                    this.showProcessDropdown.set(true);
                },
                error: (err) => {
                    console.error('Error searching processes:', err);
                    this.processes.set([]);
                }
            });
    }

    // Helper for backend errors
    public getBackendError(field: string): string | null {
        const errors = this.backendErrors();
        return errors[field] ? errors[field][0] : null;
    }

    private _createTask(): void {
        const organizationId = this._resolveOrganizationId();
        if (!organizationId) {
            this.isSaving.set(false);
            console.warn('No organization_id available for task process search');
            return;
        }

        const payload: TaskCreateRequest = {
            title: this.taskForm.value.title,
            description: this.taskForm.value.description,
            type: this.taskForm.value.type,
            due_date: this._combineDueDateTime(this.taskForm.value.due_date, this.taskForm.value.due_time),
            reminder_days: this._parseReminderDays(this.taskForm.value.reminder_days),
            status: this.taskForm.value.status,
            is_admin: false,
            organization_id: organizationId,
            process_id: this.taskForm.value.process_id
        };

        this._taskService.createTask(payload)
            .pipe(
                finalize(() => this.isSaving.set(false)),
                takeUntil(this._destroy$)
            )
            .subscribe({
                next: () => {
                    this._notifyIfSuspensionCompleted(null);
                    this.saved.emit();
                },
                error: (error) => this._handleSaveError(error),
            });
    }

    private _updateStatusOnly(task: Task): void {
        const previousStatus = this._originalStatus;
        const newStatus = this.taskForm.get('status')?.value as TaskStatus;

        this._taskService.updateTaskStatus(task.id, { status: newStatus })
            .pipe(
                finalize(() => this.isSaving.set(false)),
                takeUntil(this._destroy$)
            )
            .subscribe({
                next: () => {
                    this._notifyIfSuspensionCompleted(previousStatus);
                    this.saved.emit();
                },
                error: (error) => this._handleSaveError(error),
            });
    }

    private _updateEditableTask(task: Task): void {
        const organizationId = this._resolveOrganizationId();
        if (!organizationId) {
            this.isSaving.set(false);
            console.warn('No organization_id available for task process search');
            return;
        }

        const newStatus = this.taskForm.get('status')?.value as TaskStatus;
        const previousStatus = this._originalStatus;
        const statusChanged = newStatus !== this._originalStatus;
        const fieldChanges = this._hasFieldChanges(task);
        const requests = [];

        if (fieldChanges) {
            requests.push(this._taskService.updateTask(task.id, this._buildFieldPayload(organizationId)));
        }

        if (statusChanged) {
            requests.push(this._taskService.updateTaskStatus(task.id, { status: newStatus }));
        }

        if (requests.length === 0) {
            this.isSaving.set(false);
            this.onClose();
            return;
        }

        forkJoin(requests)
            .pipe(
                finalize(() => this.isSaving.set(false)),
                takeUntil(this._destroy$)
            )
            .subscribe({
                next: () => {
                    this._notifyIfSuspensionCompleted(previousStatus);
                    this.saved.emit();
                },
                error: (error) => this._handleSaveError(error),
            });
    }

    private _buildFieldPayload(organizationId: string): TaskUpdateRequest {
        return {
            title: this.taskForm.get('title')?.value,
            description: this.taskForm.get('description')?.value,
            type: this.taskForm.get('type')?.value,
            due_date: this._combineDueDateTime(
                this.taskForm.get('due_date')?.value,
                this.taskForm.get('due_time')?.value
            ),
            reminder_days: this._parseReminderDays(this.taskForm.get('reminder_days')?.value),
            is_admin: this.task()?.is_admin ?? false,
            organization_id: organizationId,
            process_id: this.taskForm.get('process_id')?.value
        };
    }

    private _hasFieldChanges(task: Task): boolean {
        const organizationId = this._resolveOrganizationId();
        if (!organizationId) {
            return false;
        }

        const payload = this._buildFieldPayload(organizationId);

        return (
            payload.title !== task.title ||
            payload.description !== task.description ||
            (payload.type ?? 'general') !== (task.type ?? 'general') ||
            (payload.due_date || null) !== this._normalizeDueDateTime(task.due_date) ||
            (payload.reminder_days ?? null) !== (task.reminder_days ?? null) ||
            (payload.process_id || null) !== (task.process_id || null)
        );
    }

    private _disableEditableFields(): void {
        ['title', 'description', 'type', 'due_date', 'due_time', 'reminder_days', 'process_search', 'process_id'].forEach((field) => {
            this.taskForm.get(field)?.disable({ emitEvent: false });
        });
    }

    /** Suspension tasks must be linked to a process. */
    private _syncProcessValidators(type: TaskType | null | undefined): void {
        const control = this.taskForm.get('process_id');
        if (!control || this.isStatusOnlyMode()) {
            return;
        }

        if (type === 'suspension') {
            control.setValidators([Validators.required]);
        } else {
            control.clearValidators();
            // Optional again when switching away from suspension
            control.setErrors(null);
        }
        control.updateValueAndValidity({ emitEvent: false });
    }

    private _dueDateNotPastValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
        const value = control.value as string | null;
        if (!value) {
            return null;
        }
        return isLocalDateBeforeToday(value) ? { dueDatePast: true } : null;
    };

    private _dueTimeNotPastValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const time = control.value as string | null;
            const date = this.taskForm?.get('due_date')?.value as string | null;
            if (!time || !date) {
                return null;
            }
            return isLocalDateTimeInPast(date, time) ? { dueTimePast: true } : null;
        };
    }

    /** Clears time if due date is today and current time is already past. */
    private _clampPastDueTime(date: string | null): void {
        const time = this.taskForm.get('due_time')?.value as string | null;
        if (!date || !time) {
            return;
        }
        if (isLocalDateTimeInPast(date, time)) {
            this.taskForm.patchValue({ due_time: null }, { emitEvent: false });
        }
    }

    private _notifyIfSuspensionCompleted(previousStatus: TaskStatus | null): void {
        const type = (this.taskForm.get('type')?.value ?? this.task()?.type) as TaskType | undefined;
        const status = this.taskForm.get('status')?.value as TaskStatus;
        const processId = this.taskForm.get('process_id')?.value ?? this.task()?.process_id;

        if (
            type === 'suspension'
            && status === 'completed'
            && previousStatus !== 'completed'
            && processId
        ) {
            this._processRefresh.requestRefresh(processId);
        }
    }

    private _clearFieldError(field: string): void {
        this.backendErrors.update((errs) => {
            if (!errs[field]) {
                return errs;
            }
            const next = { ...errs };
            delete next[field];
            return next;
        });
    }

    private _scrollToProcessField(): void {
        queueMicrotask(() => {
            this._processSearchContainer?.nativeElement?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        });
    }

    private _handleSaveError(error: unknown): void {
        const httpError = error as HttpErrorResponse;
        const body = httpError?.error;

        if (httpError?.status === 422 && body && typeof body === 'object') {
            const fieldErrors = this._extractFieldErrors(body as Record<string, unknown>);
            const message =
                (typeof (body as { message?: unknown }).message === 'string'
                    && (body as { message: string }).message.trim())
                || fieldErrors['process_id']?.[0]
                || this._firstFieldError(fieldErrors)
                || this._transloco.translate('tasks.messages.validationError');

            this.backendErrors.set(fieldErrors);
            this.formError.set(message);

            if (fieldErrors['process_id']?.length) {
                this._scrollToProcessField();
            }
            return;
        }

        this.formError.set(this._transloco.translate('tasks.messages.error'));
        console.error('Error saving task:', error);
    }

    private _extractFieldErrors(body: Record<string, unknown>): Record<string, string[]> {
        const raw = body['errors'];
        if (!raw || typeof raw !== 'object') {
            return {};
        }

        const result: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
            if (Array.isArray(value)) {
                result[key] = value.map(String);
            } else if (typeof value === 'string') {
                result[key] = [value];
            }
        }
        return result;
    }

    private _firstFieldError(errors: Record<string, string[]>): string | null {
        for (const messages of Object.values(errors)) {
            if (messages?.[0]) {
                return messages[0];
            }
        }
        return null;
    }
}
