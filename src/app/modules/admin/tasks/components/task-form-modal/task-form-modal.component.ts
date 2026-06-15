import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { TaskService } from '@app/core/services/task/task.service';
import { Task, ProcessSummary, TaskCreateRequest, TaskStatusOption, TaskStatus, TaskUpdateRequest } from '@app/core/models/tasks/task.model';
import { finalize, Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';

@Component({
    selector: 'app-task-form-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslocoModule, ProcessNumberPipe, ConfirmationDialogComponent, DatePickerComponent],
    templateUrl: './task-form-modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormModalComponent implements OnInit, OnDestroy {
    private _fb = inject(FormBuilder);
    private _taskService = inject(TaskService);
    private _authService = inject(AuthService);
    private _el = inject(ElementRef);
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
    public closed = output<void>();
    public saved = output<void>();

    // State
    public taskForm: FormGroup;
    public isSaving = signal(false);
    public showConfirmDialog = signal(false);
    public isSearchingProcesses = signal(false);
    public processes = signal<ProcessSummary[]>([]);
    public showProcessDropdown = signal(false);
    public taskStatuses = signal<TaskStatusOption[]>([]);
    
    // For handling backend errors
    public backendErrors = signal<Record<string, string[]>>({});

    constructor() {
        this.taskForm = this._fb.group({
            title: ['', [Validators.required, Validators.maxLength(255)]],
            description: ['', [Validators.required]],
            due_date: [null as string | null],
            reminder_days: [null as number | null, [Validators.min(0), Validators.max(365)]],
            status: ['pending', [Validators.required]],
            process_id: [null],
            process_search: [''] // Temporary field for searching
        });
    }

    ngOnInit(): void {
        this._loadStatuses();

        if (this.task()) {
            const currentTask = this.task()!;
            const formattedProcessNumber = currentTask.process_number
                ? new ProcessNumberPipe().transform(currentTask.process_number)
                : '';

            this._originalStatus = currentTask.status ?? 'pending';

            this.taskForm.patchValue({
                title: currentTask.title,
                description: currentTask.description,
                due_date: currentTask.due_date ?? null,
                reminder_days: currentTask.reminder_days ?? null,
                status: this._originalStatus,
                process_id: currentTask.process_id,
                process_search: formattedProcessNumber
            });

            if (currentTask.process_id && formattedProcessNumber) {
                this._selectedProcessDisplay.set(formattedProcessNumber);
            }

            if (this.isStatusOnlyMode()) {
                this._disableEditableFields();
            }
        }

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
            return;
        }

        this.showConfirmDialog.set(true);
    }

    public onConfirmSave(): void {
        this.showConfirmDialog.set(false);
        this.isSaving.set(true);
        this.backendErrors.set({});

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
        this.backendErrors.update(errs => {
            const next = { ...errs };
            delete next['process_id'];
            return next;
        });
    }

    public clearProcess(): void {
        this._selectedProcessDisplay.set(null);
        this.taskForm.patchValue({
            process_id: null,
            process_search: ''
        });
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
            due_date: this.taskForm.value.due_date || null,
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
                next: () => this.saved.emit(),
                error: (error) => this._handleSaveError(error),
            });
    }

    private _updateStatusOnly(task: Task): void {
        const newStatus = this.taskForm.get('status')?.value as TaskStatus;

        this._taskService.updateTaskStatus(task.id, { status: newStatus })
            .pipe(
                finalize(() => this.isSaving.set(false)),
                takeUntil(this._destroy$)
            )
            .subscribe({
                next: () => this.saved.emit(),
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
                next: () => this.saved.emit(),
                error: (error) => this._handleSaveError(error),
            });
    }

    private _buildFieldPayload(organizationId: string): TaskUpdateRequest {
        return {
            title: this.taskForm.get('title')?.value,
            description: this.taskForm.get('description')?.value,
            due_date: this.taskForm.get('due_date')?.value || null,
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
            (payload.due_date || null) !== (task.due_date || null) ||
            (payload.reminder_days ?? null) !== (task.reminder_days ?? null) ||
            (payload.process_id || null) !== (task.process_id || null)
        );
    }

    private _disableEditableFields(): void {
        ['title', 'description', 'due_date', 'reminder_days', 'process_search', 'process_id'].forEach((field) => {
            this.taskForm.get(field)?.disable({ emitEvent: false });
        });
    }

    private _handleSaveError(error: { status?: number; error?: { errors?: Record<string, string[]> } }): void {
        if (error.status === 422 && error.error?.errors) {
            this.backendErrors.set(error.error.errors);
        } else {
            console.error('Error saving task:', error);
        }
    }
}
