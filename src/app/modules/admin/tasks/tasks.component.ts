import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TaskService } from '@app/core/services/task/task.service';
import { Task, TaskPagination, TaskStatus, TaskView } from '@app/core/models/tasks/task.model';
import { finalize, Subject, takeUntil } from 'rxjs';
import { IconService } from '@app/core/services/icon/icon.service';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { TaskFormModalComponent } from './components/task-form-modal/task-form-modal.component';
import { TaskDetailModalComponent } from './components/task-detail-modal/task-detail-modal.component';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { getTaskUrgencyClass, getTaskUrgencyInfo, TaskUrgencyInfo } from '@app/core/utils/task-urgency.util';

type TaskTab = {
    view: TaskView;
    labelKey: string;
    emptyKey: string;
};

@Component({
    selector: 'app-tasks',
    standalone: true,
    imports: [
        CommonModule,
        TranslocoModule,
        ConfirmationDialogComponent,
        TaskFormModalComponent,
        TaskDetailModalComponent,
        ProcessNumberPipe,
    ],
    templateUrl: './tasks.component.html',
    styleUrls: ['./tasks.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksComponent implements OnInit, OnDestroy {
    private _taskService = inject(TaskService);
    private _iconService = inject(IconService);
    private _router = inject(Router);
    private _activatedRoute = inject(ActivatedRoute);
    private _destroy$ = new Subject<void>();
    private _queryParamsSubscription?: { unsubscribe: () => void };
    private _openingTaskId: string | null = null;

    public readonly tabs: TaskTab[] = [
        { view: 'pending', labelKey: 'tasks.tabs.pending', emptyKey: 'tasks.emptyPending' },
        { view: 'draft', labelKey: 'tasks.tabs.draft', emptyKey: 'tasks.emptyDraft' },
        { view: 'completed', labelKey: 'tasks.tabs.completed', emptyKey: 'tasks.emptyCompleted' },
        { view: 'trash', labelKey: 'tasks.tabs.trash', emptyKey: 'tasks.emptyTrash' },
    ];

    public tasks = signal<Task[]>([]);
    public isLoading = signal(false);
    public isDeleting = signal(false);
    public isRestoring = signal(false);
    public isForceDeleting = signal(false);
    public isCompleting = signal(false);
    public currentPage = signal(1);
    public lastPage = signal(1);
    public totalTasks = signal(0);
    public activeView = signal<TaskView>('pending');
    public loadedView = signal<TaskView | null>(null);
    public isViewReady = computed(() => this.loadedView() === this.activeView());
    public hasMore = computed(() => this.currentPage() < this.lastPage());
    public isTrashView = computed(() => this.activeView() === 'trash');
    public showUrgencyLegend = computed(() => this.activeView() === 'pending');

    public showFormModal = signal(false);
    public showDetailModal = signal(false);
    public selectedTask = signal<Task | null>(null);
    public detailTask = signal<Task | null>(null);
    public showDeleteConfirm = signal(false);
    public showForceDeleteConfirm = signal(false);
    public showCompleteConfirm = signal(false);
    public taskToDelete = signal<Task | null>(null);
    public taskToForceDelete = signal<Task | null>(null);
    public taskToComplete = signal<Task | null>(null);
    public alert = signal<{ type: 'success' | 'error'; message: string } | null>(null);

    ngOnInit(): void {
        const initialTaskId = this._activatedRoute.snapshot.queryParamMap.get('task');
        if (initialTaskId) {
            this._openTaskFromId(initialTaskId, true);
        } else {
            this.loadTasks();
        }

        this._queryParamsSubscription = this._activatedRoute.queryParamMap.subscribe((params) => {
            this._handleTaskQueryParam(params);
        });
    }

    ngOnDestroy(): void {
        this._queryParamsSubscription?.unsubscribe();
        this._destroy$.next();
        this._destroy$.complete();
    }

    public loadTasks(page: number = 1): void {
        if (this.isLoading() && page > 1) return;

        if (page === 1) {
            this.loadedView.set(null);
        }

        this.isLoading.set(true);
        const request$ = this.isTrashView()
            ? this._taskService.getTrashTasks(page, 20)
            : this._taskService.getTasks(page, 20, this.activeView() as TaskStatus);

        request$
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => this.isLoading.set(false))
            )
            .subscribe({
                next: (response: TaskPagination) => {
                    if (page === 1) {
                        this.tasks.set(response.data);
                        this.loadedView.set(this.activeView());
                    } else {
                        this.tasks.update(current => [...current, ...response.data]);
                    }
                    this.currentPage.set(response.current_page);
                    this.lastPage.set(response.last_page);
                    this.totalTasks.set(response.total);
                },
                error: (error) => {
                    console.error('Error loading tasks:', error);
                    if (page === 1) {
                        this.tasks.set([]);
                        this.loadedView.set(this.activeView());
                    }
                    this.showAlert('error', 'tasks.messages.loadError');
                }
            });
    }

    public setActiveView(view: TaskView): void {
        if (this.activeView() === view) return;
        this.activeView.set(view);
        this.tasks.set([]);
        this.currentPage.set(1);
        this.totalTasks.set(0);
        this.loadTasks(1);
    }

    public openCreateModal(): void {
        this.selectedTask.set(null);
        this.showFormModal.set(true);
    }

    public openEditModal(task: Task): void {
        if (!this.canEditFields(task) && !this.canChangeStatus(task)) return;
        this.showDetailModal.set(false);
        this.selectedTask.set(task);
        this.showFormModal.set(true);
    }

    public openStatusModal(task: Task): void {
        if (!this.canChangeStatus(task)) return;
        this.showDetailModal.set(false);
        this.selectedTask.set(task);
        this.showFormModal.set(true);
    }

    public openDetailModal(task: Task): void {
        this.detailTask.set(task);
        this.showDetailModal.set(true);
        this.syncTaskQueryParams(task.id);
    }

    public closeDetailModal(): void {
        this.showDetailModal.set(false);
        this.detailTask.set(null);
        this.clearTaskQueryParams();
    }

    public onDetailEdit(task: Task): void {
        this.closeDetailModal();
        if (this.canEditFields(task)) {
            this.openEditModal(task);
        } else {
            this.openStatusModal(task);
        }
    }

    public onDetailComplete(task: Task): void {
        this.closeDetailModal();
        this.confirmComplete(task);
    }

    public onDetailRestore(task: Task): void {
        this.closeDetailModal();
        this.confirmRestore(task);
    }

    public onDetailForceDelete(task: Task): void {
        this.closeDetailModal();
        this.confirmForceDelete(task);
    }

    public confirmDelete(task: Task): void {
        if (!this.canMoveToTrash(task)) return;
        this.taskToDelete.set(task);
        this.showDeleteConfirm.set(true);
    }

    public confirmRestore(task: Task): void {
        if (!this.isTrashTask(task)) return;
        this._restoreTask(task);
    }

    public confirmForceDelete(task: Task): void {
        if (!this.isTrashTask(task)) return;
        this.taskToForceDelete.set(task);
        this.showForceDeleteConfirm.set(true);
    }

    public confirmComplete(task: Task): void {
        this.taskToComplete.set(task);
        this.showCompleteConfirm.set(true);
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
                    this.totalTasks.update(total => Math.max(0, total - 1));
                    this.showAlert('success', 'tasks.messages.movedToTrash');
                },
                error: (error) => {
                    console.error('Error moving task to trash:', error);
                    this.showAlert('error', 'tasks.messages.moveToTrashError');
                }
            });
    }

    public onForceDeleteConfirm(): void {
        const task = this.taskToForceDelete();
        if (!task) return;

        this.isForceDeleting.set(true);
        this._taskService.forceDeleteTask(task.id)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => {
                    this.isForceDeleting.set(false);
                    this.showForceDeleteConfirm.set(false);
                    this.taskToForceDelete.set(null);
                })
            )
            .subscribe({
                next: () => {
                    this.tasks.update(current => current.filter(t => t.id !== task.id));
                    this.totalTasks.update(total => Math.max(0, total - 1));
                    this.showAlert('success', 'tasks.messages.forceDeleted');
                },
                error: (error) => {
                    console.error('Error permanently deleting task:', error);
                    this.showAlert('error', 'tasks.messages.forceDeleteError');
                }
            });
    }

    public onCompleteConfirm(): void {
        const task = this.taskToComplete();
        if (!task) return;

        this.isCompleting.set(true);
        this._taskService.completeTask(task.id)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => {
                    this.isCompleting.set(false);
                    this.showCompleteConfirm.set(false);
                    this.taskToComplete.set(null);
                })
            )
            .subscribe({
                next: () => {
                    this.tasks.update(current => current.filter(t => t.id !== task.id));
                    this.totalTasks.update(total => Math.max(0, total - 1));
                    this.showAlert('success', 'tasks.messages.completed');
                },
                error: (error) => {
                    console.error('Error completing task:', error);
                    this.showAlert('error', 'tasks.messages.completeError');
                }
            });
    }

    public onTaskSaved(): void {
        const editedTask = this.selectedTask();
        const wasStatusOnly = editedTask?.status === 'completed';
        this.showFormModal.set(false);
        this.selectedTask.set(null);
        this.loadTasks(1);
        this.showAlert('success', wasStatusOnly ? 'tasks.messages.statusUpdated' : (editedTask ? 'tasks.messages.updated' : 'tasks.messages.created'));
    }

    public showAlert(type: 'success' | 'error', message: string): void {
        this.alert.set({ type, message });
        setTimeout(() => this.alert.set(null), 4000);
    }

    public getIconPath(iconName: string): string {
        return this._iconService.getIconPath(iconName);
    }

    public getUrgencyInfo(task: Task): TaskUrgencyInfo | null {
        if (task.status === 'completed' || this.isTrashTask(task)) {
            return null;
        }
        return getTaskUrgencyInfo(task.created_at);
    }

    public getUrgencyClass(task: Task): string {
        const info = this.getUrgencyInfo(task);
        return info ? getTaskUrgencyClass(info.level) : '';
    }

    public canMarkComplete(task: Task): boolean {
        return !this.isTrashTask(task) && (task.status === 'pending' || task.status === 'draft');
    }

    public canEditFields(task: Task): boolean {
        return !this.isTrashTask(task) && (task.status === 'pending' || task.status === 'draft');
    }

    public canChangeStatus(task: Task): boolean {
        return !this.isTrashTask(task) && !!task;
    }

    public canMoveToTrash(task: Task): boolean {
        return this.canEditFields(task);
    }

    public canModifyTask(task: Task): boolean {
        return this.canEditFields(task);
    }

    public isTrashTask(task: Task): boolean {
        return !!task.deleted_at || this.isTrashView();
    }

    public getActiveTabEmptyKey(): string {
        return this.tabs.find(tab => tab.view === this.activeView())?.emptyKey ?? 'tasks.empty';
    }

    public copyToClipboard(text: string, event?: Event): void {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!text) return;

        const cleanText = text.replace(/-/g, '').trim();

        navigator.clipboard.writeText(cleanText).then(() => {
            this.showAlert('success', 'tasks.messages.copied');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            this.showAlert('error', 'tasks.messages.copyError');
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

    private _handleTaskQueryParam(params: ParamMap): void {
        const taskId = params.get('task');
        if (taskId) {
            this._openTaskFromId(taskId);
            return;
        }

        if (this.showDetailModal()) {
            this.showDetailModal.set(false);
            this.detailTask.set(null);
        }
    }

    private _openTaskFromId(taskId: string, isInitial = false): void {
        if (this._openingTaskId === taskId) {
            return;
        }

        if (this.showDetailModal() && this.detailTask()?.id === taskId) {
            return;
        }

        this._openingTaskId = taskId;

        this._taskService.getTask(taskId)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => {
                    if (this._openingTaskId === taskId) {
                        this._openingTaskId = null;
                    }
                })
            )
            .subscribe({
                next: (task) => {
                    const targetView: TaskView = task.deleted_at ? 'trash' : task.status;

                    if (this.activeView() !== targetView) {
                        this.activeView.set(targetView);
                        this.tasks.set([]);
                        this.currentPage.set(1);
                        this.totalTasks.set(0);
                        this.loadTasks(1);
                    } else if (isInitial && !this.loadedView()) {
                        this.loadTasks(1);
                    }

                    this.detailTask.set(task);
                    this.showDetailModal.set(true);
                },
                error: (error) => {
                    console.error('Error loading task detail:', error);
                    this.clearTaskQueryParams();
                    this.showDetailModal.set(false);
                    this.detailTask.set(null);
                    this.showAlert('error', 'tasks.messages.taskNotFound');
                    if (isInitial && !this.loadedView()) {
                        this.loadTasks(1);
                    }
                },
            });
    }

    private syncTaskQueryParams(taskId: string): void {
        this._router.navigate([], {
            relativeTo: this._activatedRoute,
            queryParams: { task: taskId },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    private clearTaskQueryParams(): void {
        this._router.navigate([], {
            relativeTo: this._activatedRoute,
            queryParams: { task: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    private _restoreTask(task: Task): void {
        this.isRestoring.set(true);
        this._taskService.restoreTask(task.id)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => this.isRestoring.set(false))
            )
            .subscribe({
                next: () => {
                    this.tasks.update(current => current.filter(t => t.id !== task.id));
                    this.totalTasks.update(total => Math.max(0, total - 1));
                    this.showAlert('success', 'tasks.messages.restored');
                },
                error: (error) => {
                    console.error('Error restoring task:', error);
                    this.showAlert('error', 'tasks.messages.restoreError');
                }
            });
    }
}
