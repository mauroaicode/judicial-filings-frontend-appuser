import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostBinding,
  effect,
  inject,
  input,
  output,
  signal,
  computed,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProcessService } from '@app/core/services/process/process.service';
import { TaskService } from '@app/core/services/task/task.service';
import { Task, TaskPagination, TaskStatus } from '@app/core/models/tasks/task.model';
import { getTaskUrgencyClass, getTaskUrgencyInfo, TaskUrgencyInfo } from '@app/core/utils/task-urgency.util';
import { TaskDetailModalComponent } from '@app/modules/admin/tasks/components/task-detail-modal/task-detail-modal.component';
import { TaskFormModalComponent } from '@app/modules/admin/tasks/components/task-form-modal/task-form-modal.component';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { IconService } from '@app/core/services/icon/icon.service';
import { ProcessRefreshService } from '@app/core/services/process/process-refresh.service';
import { TranslocoService } from '@jsverse/transloco';

const PER_PAGE = 20;
const SCROLL_LOAD_THRESHOLD = 200;

type StatusTab = { status: TaskStatus; labelKey: string };

@Component({
  selector: 'app-process-tasks-drawer',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    TranslocoPipe,
    TaskDetailModalComponent,
    TaskFormModalComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './process-tasks-drawer.component.html',
  styleUrls: ['./process-tasks-drawer.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessTasksDrawerComponent {
  private _processService = inject(ProcessService);
  private _taskService = inject(TaskService);
  private _iconService = inject(IconService);
  private _destroyRef = inject(DestroyRef);
  private _processRefresh = inject(ProcessRefreshService);
  private _transloco = inject(TranslocoService);

  readonly isOpen = input(false);
  readonly processId = input.required<string>();

  readonly closed = output<void>();
  readonly tasksCountChange = output<number>();
  /** Fired after a suspension task is completed (process becomes active). */
  readonly processReactivated = output<void>();

  readonly toastMessage = signal<string | null>(null);

  @HostBinding('class.process-tasks-drawer-open')
  get isDrawerOpen(): boolean {
    return this.isOpen();
  }

  readonly tabs: StatusTab[] = [
    { status: 'pending', labelKey: 'tasks.tabs.pending' },
    { status: 'draft', labelKey: 'tasks.tabs.draft' },
    { status: 'completed', labelKey: 'tasks.tabs.completed' },
  ];

  readonly activeStatus = signal<TaskStatus>('pending');
  readonly tasks = signal<Task[]>([]);
  readonly pagination = signal<Pick<TaskPagination, 'current_page' | 'last_page' | 'total'> | null>(null);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedTask = signal<Task | null>(null);
  readonly editingTask = signal<Task | null>(null);
  readonly showFormModal = signal(false);
  readonly confirmCompleteOpen = signal(false);
  readonly taskPendingComplete = signal<Task | null>(null);
  readonly actionInProgress = signal(false);

  readonly hasMore = computed(() => {
    const meta = this.pagination();
    if (!meta) return false;
    return meta.current_page < meta.last_page;
  });

  readonly totalForTab = computed(() => this.pagination()?.total ?? 0);

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const processId = this.processId();

      if (open && processId) {
        this.activeStatus.set('pending');
        this.tasks.set([]);
        this.pagination.set(null);
        this.error.set(null);
        this.selectedTask.set(null);
        this.loadTasks(1, false);
        document.body.classList.add('process-tasks-drawer-body-open');
      } else {
        document.body.classList.remove('process-tasks-drawer-body-open');
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  onToggleChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!checked) {
      this.closed.emit();
    }
  }

  setActiveStatus(status: TaskStatus): void {
    if (this.activeStatus() === status) return;
    this.activeStatus.set(status);
    this.tasks.set([]);
    this.pagination.set(null);
    this.loadTasks(1, false);
  }

  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (!el || !this.hasMore() || this.loadingMore() || this.loading()) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD) {
      this.loadMore();
    }
  }

  loadMore(): void {
    const meta = this.pagination();
    if (!meta || meta.current_page >= meta.last_page) return;
    this.loadTasks(meta.current_page + 1, true);
  }

  openDetail(task: Task): void {
    this.selectedTask.set(task);
  }

  closeDetail(): void {
    this.selectedTask.set(null);
  }

  onDetailEdit(task: Task): void {
    this.selectedTask.set(null);
    this.editingTask.set(task);
    this.showFormModal.set(true);
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingTask.set(null);
  }

  onTaskSaved(): void {
    this.closeFormModal();
    this.loadTasks(1, false);
    this.emitPendingCountRefresh();
  }

  getUrgencyInfo(task: Task): TaskUrgencyInfo | null {
    return getTaskUrgencyInfo(task);
  }

  getUrgencyClass(task: Task): string {
    const info = this.getUrgencyInfo(task);
    return info ? getTaskUrgencyClass(info.level) : '';
  }

  canMarkComplete(task: Task): boolean {
    return task.status === 'pending' || task.status === 'draft';
  }

  getIconPath(iconName: string): string {
    return this._iconService.getIconPath(iconName);
  }

  confirmComplete(task: Task): void {
    this.taskPendingComplete.set(task);
    this.confirmCompleteOpen.set(true);
  }

  onCancelComplete(): void {
    this.confirmCompleteOpen.set(false);
    this.taskPendingComplete.set(null);
  }

  onConfirmComplete(): void {
    const task = this.taskPendingComplete();
    this.confirmCompleteOpen.set(false);
    this.taskPendingComplete.set(null);
    if (!task) return;

    this.actionInProgress.set(true);
    this._taskService
      .completeTask(task.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (completed) => {
          this.actionInProgress.set(false);
          this.selectedTask.set(null);
          this.loadTasks(1, false);
          this.emitPendingCountRefresh();

          const isSuspension =
            (completed?.type ?? task.type) === 'suspension'
            && !!(completed?.process_id ?? task.process_id);

          if (isSuspension) {
            const processId = completed?.process_id ?? task.process_id;
            this._processRefresh.requestRefresh(processId);
            this.processReactivated.emit();
            this.toastMessage.set(
              this._transloco.translate('tasks.messages.completedSuspensionReactivated')
            );
            setTimeout(() => this.toastMessage.set(null), 4000);
          }
        },
        error: () => {
          this.actionInProgress.set(false);
        },
      });
  }

  getCompleteConfirmMessageKey(): string {
    const task = this.taskPendingComplete();
    if (task?.type === 'suspension' && task.process_id) {
      return 'tasks.complete.messageSuspension';
    }
    return 'tasks.complete.message';
  }

  onDetailComplete(task: Task): void {
    this.confirmComplete(task);
  }

  private emitPendingCountRefresh(): void {
    const processId = this.processId();
    if (!processId) return;

    this._processService
      .getProcessTasks(processId, 1, 1, { status: 'pending' })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (res) => this.tasksCountChange.emit(res.total ?? 0),
      });
  }

  private loadTasks(page: number, append: boolean): void {
    const processId = this.processId();
    if (!processId) return;

    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    this._processService
      .getProcessTasks(processId, page, PER_PAGE, { status: this.activeStatus() })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          if (append) {
            this.tasks.update((prev) => [...prev, ...response.data]);
            this.loadingMore.set(false);
          } else {
            this.tasks.set(response.data);
            this.loading.set(false);
          }
          this.pagination.set({
            current_page: response.current_page,
            last_page: response.last_page,
            total: response.total,
          });

          if (this.activeStatus() === 'pending') {
            this.tasksCountChange.emit(response.total ?? 0);
          }
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Error al cargar tareas');
          if (!append) {
            this.tasks.set([]);
            this.pagination.set(null);
          }
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }
}
