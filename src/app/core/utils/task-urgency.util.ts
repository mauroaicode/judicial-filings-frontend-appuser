import { Task, TaskUrgencyLevelApi } from '@app/core/models/tasks/task.model';

/** CSS class suffix (kebab-case). */
export type TaskUrgencyLevel = 'normal' | 'alert-1' | 'alert-2' | 'critical';

export interface TaskUrgencyInfo {
    level: TaskUrgencyLevel;
    days: number;
    /** Localized label from backend (`urgency_label`). */
    label: string;
}

const LEVEL_TO_CSS: Record<TaskUrgencyLevelApi, TaskUrgencyLevel> = {
    normal: 'normal',
    alert_1: 'alert-1',
    alert_2: 'alert-2',
    critical: 'critical',
};

export function normalizeUrgencyLevel(
    level: string | null | undefined
): TaskUrgencyLevel | null {
    if (!level) {
        return null;
    }

    if (level in LEVEL_TO_CSS) {
        return LEVEL_TO_CSS[level as TaskUrgencyLevelApi];
    }

    // Tolerate already-kebab values if present
    if (level === 'alert-1' || level === 'alert-2' || level === 'normal' || level === 'critical') {
        return level;
    }

    return null;
}

/**
 * Builds urgency display data from backend fields only.
 * Returns null when the task should not show a traffic-light (no level / not pending).
 */
export function getTaskUrgencyInfo(task: Task): TaskUrgencyInfo | null {
    if (task.status !== 'pending') {
        return null;
    }

    const level = normalizeUrgencyLevel(task.urgency_level);
    if (!level) {
        return null;
    }

    return {
        level,
        days: typeof task.days_overdue === 'number' ? Math.max(0, task.days_overdue) : 0,
        label: task.urgency_label?.trim() || '',
    };
}

export function getTaskUrgencyClass(level: TaskUrgencyLevel | null | undefined): string {
    return level ? `task-urgency--${level}` : '';
}
