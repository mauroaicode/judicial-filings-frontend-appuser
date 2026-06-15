import { ChangeDetectionStrategy, Component, inject, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { Task } from '@app/core/models/tasks/task.model';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { IconService } from '@app/core/services/icon/icon.service';
import { getTaskUrgencyClass, getTaskUrgencyInfo } from '@app/core/utils/task-urgency.util';

@Component({
    selector: 'app-task-detail-modal',
    standalone: true,
    imports: [CommonModule, TranslocoModule, ProcessNumberPipe],
    templateUrl: './task-detail-modal.component.html',
    styleUrls: ['./task-detail-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailModalComponent {
    private _iconService = inject(IconService);

    public task = input.required<Task>();
    public isTrash = input(false);
    public closed = output<void>();
    public edit = output<Task>();
    public complete = output<Task>();
    public restore = output<Task>();
    public forceDelete = output<Task>();
    public copyRadicado = output<string>();

    public canModify = computed(() => !this.isTrash() && (this.task().status === 'pending' || this.task().status === 'draft'));
    public canChangeStatus = computed(() => !this.isTrash() && this.task().status === 'completed');
    public canRestore = computed(() => this.isTrash());
    public canForceDelete = computed(() => this.isTrash());
    public canComplete = computed(() => {
        if (this.isTrash()) return false;
        const status = this.task().status;
        return status === 'pending' || status === 'draft';
    });

    public urgencyInfo = computed(() => {
        if (this.isTrash() || this.task().status === 'completed') {
            return null;
        }
        return getTaskUrgencyInfo(this.task().created_at);
    });

    public urgencyClass = computed(() => {
        const info = this.urgencyInfo();
        return info ? getTaskUrgencyClass(info.level) : '';
    });

    public getIconPath(iconName: string): string {
        return this._iconService.getIconPath(iconName);
    }

    public onClose(): void {
        this.closed.emit();
    }

    public onEdit(): void {
        this.edit.emit(this.task());
    }

    public onComplete(): void {
        this.complete.emit(this.task());
    }

    public onRestore(): void {
        this.restore.emit(this.task());
    }

    public onForceDelete(): void {
        this.forceDelete.emit(this.task());
    }

    public onCopyRadicado(event: Event): void {
        event.stopPropagation();
        const number = this.task().process_number;
        if (number) {
            this.copyRadicado.emit(number);
        }
    }
}
