import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { TaskService } from '@app/core/services/task/task.service';
import { Task, ProcessSummary, TaskCreateRequest } from '@app/core/models/tasks/task.model';
import { finalize, Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '@app/core/auth/auth.service';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
    selector: 'app-task-form-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslocoModule, ProcessNumberPipe, ConfirmationDialogComponent],
    templateUrl: './task-form-modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormModalComponent implements OnInit, OnDestroy {
    private _fb = inject(FormBuilder);
    private _taskService = inject(TaskService);
    private _authService = inject(AuthService);
    private _el = inject(ElementRef);
    private _destroy$ = new Subject<void>();

    @HostListener('document:click', ['$event'])
    onClickOutside(event: Event) {
        if (!this._el.nativeElement.contains(event.target)) {
            this.showProcessDropdown.set(false);
        }
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
    
    // For handling backend errors
    public backendErrors = signal<Record<string, string[]>>({});

    constructor() {
        this.taskForm = this._fb.group({
            title: ['', [Validators.required, Validators.maxLength(255)]],
            description: ['', [Validators.required]],
            process_id: [null],
            process_search: [''] // Temporary field for searching
        });
    }

    ngOnInit(): void {
        if (this.task()) {
            this.taskForm.patchValue({
                title: this.task()?.title,
                description: this.task()?.description,
                process_id: this.task()?.process_id,
                process_search: this.task()?.process_number ? new ProcessNumberPipe().transform(this.task()?.process_number) : ''
            });
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
        if (this.taskForm.invalid) {
            this.taskForm.markAllAsTouched();
            return;
        }
        
        // Before saving, show confirmation dialog
        this.showConfirmDialog.set(true);
    }

    public onConfirmSave(): void {
        this.showConfirmDialog.set(false);
        this.isSaving.set(true);
        this.backendErrors.set({});

        const organizationId = this.task()?.organization_id || this._authService.organizationId || '';

        const payload: TaskCreateRequest = {
            title: this.taskForm.value.title,
            description: this.taskForm.value.description,
            is_admin: this.task()?.is_admin ?? false,
            organization_id: organizationId,
            process_id: this.taskForm.value.process_id
        };

        const request$ = this.task() 
            ? this._taskService.updateTask(this.task()!.id, payload)
            : this._taskService.createTask(payload);

        request$.pipe(
            finalize(() => this.isSaving.set(false)),
            takeUntil(this._destroy$)
        ).subscribe({
            next: () => {
                this.saved.emit();
            },
            error: (error) => {
                if (error.status === 422 && error.error?.errors) {
                    this.backendErrors.set(error.error.errors);
                } else {
                    console.error('Error saving task:', error);
                }
            }
        });
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
        this.taskForm.patchValue({
            process_id: null,
            process_search: ''
        });
        this._searchProcesses(''); // Refresh list
    }

    private _searchProcesses(query: string): void {
        this.isSearchingProcesses.set(true);
        const organizationId = this.task()?.organization_id || 'c93bde00-8456-4b43-9bd4-07fac136c864';
        
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
}
