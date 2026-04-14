import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TaskService } from '@app/core/services/task/task.service';
import { Task, TaskPagination } from '@app/core/models/tasks/task.model';
import { finalize, Subject, takeUntil } from 'rxjs';
import { IconService } from '@app/core/services/icon/icon.service';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { TaskFormModalComponent } from './components/task-form-modal/task-form-modal.component';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';

@Component({
    selector: 'app-tasks',
    standalone: true,
    imports: [
        CommonModule, 
        TranslocoModule, 
        ConfirmationDialogComponent, 
        TaskFormModalComponent,
        ProcessNumberPipe
    ],
    templateUrl: './tasks.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksComponent implements OnInit, OnDestroy {
    private _taskService = inject(TaskService);
    private _translocoService = inject(TranslocoService);
    private _iconService = inject(IconService);
    private _destroy$ = new Subject<void>();

    // States
    public tasks = signal<Task[]>([]);
    public isLoading = signal(false);
    public isDeleting = signal(false);
    public currentPage = signal(1);
    public lastPage = signal(1);
    public hasMore = computed(() => this.currentPage() < this.lastPage());

    // Modal states
    public showFormModal = signal(false);
    public selectedTask = signal<Task | null>(null);

    // Confirmation dialog states
    public showDeleteConfirm = signal(false);
    public taskToDelete = signal<Task | null>(null);

    // Alert states
    public alert = signal<{ type: 'success' | 'error'; message: string } | null>(null);

    ngOnInit(): void {
        this.loadTasks();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    public loadTasks(page: number = 1): void {
        if (this.isLoading()) return;

        this.isLoading.set(true);
        this._taskService.getTasks(page, 10)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => this.isLoading.set(false))
            )
            .subscribe({
                next: (response: TaskPagination) => {
                    if (page === 1) {
                        this.tasks.set(response.data);
                    } else {
                        this.tasks.update(current => [...current, ...response.data]);
                    }
                    this.currentPage.set(response.current_page);
                    this.lastPage.set(response.last_page);
                },
                error: (error) => {
                    console.error('Error loading tasks:', error);
                    this.showAlert('error', 'Ocurrió un error al cargar las tareas.');
                }
            });
    }

    public openCreateModal(): void {
        this.selectedTask.set(null);
        this.showFormModal.set(true);
    }

    public openEditModal(task: Task): void {
        this.selectedTask.set(task);
        this.showFormModal.set(true);
    }

    public confirmDelete(task: Task): void {
        this.taskToDelete.set(task);
        this.showDeleteConfirm.set(true);
    }

    public onDeleteConfirm(): void {
        const task = this.taskToDelete();
        if (!task) return;

        this.isDeleting.set(true);
        this._taskService.deleteTask(task.id)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => {
                    this.isDeleting.set(false);
                    this.showDeleteConfirm.set(false);
                    this.taskToDelete.set(null);
                })
            )
            .subscribe({
                next: () => {
                    this.tasks.update(current => current.filter(t => t.id !== task.id));
                    this.showAlert('success', 'La tarea ha sido eliminada permanentemente.');
                },
                error: (error) => {
                    console.error('Error deleting task:', error);
                    this.showAlert('error', 'No se pudo eliminar la tarea. Inténtalo de nuevo.');
                }
            });
    }

    public onTaskSaved(): void {
        const isEdit = !!this.selectedTask();
        this.showFormModal.set(false);
        this.loadTasks(1); // Refresh list
        this.showAlert('success', isEdit ? 'La tarea se ha actualizado correctamente.' : 'La tarea se ha creado exitosamente.');
    }

    public showAlert(type: 'success' | 'error', message: string): void {
        this.alert.set({ type, message });
        // Auto-hide alert/toast after 4 seconds
        setTimeout(() => this.alert.set(null), 4000);
    }

    public getIconPath(iconName: string): string {
        return this._iconService.getIconPath(iconName);
    }

    /**
     * Copy process number to clipboard without hyphens
     */
    public copyToClipboard(text: string, event?: Event): void {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!text) return;

        // Strip hyphens
        const cleanText = text.replace(/-/g, '').trim();

        navigator.clipboard.writeText(cleanText).then(() => {
            this.showAlert('success', 'Número de radicado copiado al portapapeles.');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            this.showAlert('error', 'No se pudo copiar el número.');
        });
    }

    @HostListener('window:scroll', [])
    onWindowScroll() {
        if (this.isLoading() || !this.hasMore()) return;

        const pos = (document.documentElement.scrollTop || document.body.scrollTop) + document.documentElement.offsetHeight;
        const max = document.documentElement.scrollHeight;

        if (pos > max - 100) {
            this.loadTasks(this.currentPage() + 1);
        }
    }
}
