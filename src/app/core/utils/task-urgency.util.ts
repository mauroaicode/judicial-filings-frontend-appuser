export type TaskUrgencyLevel = 'normal' | 'alert-1' | 'alert-2' | 'critical';

export interface TaskUrgencyInfo {
    level: TaskUrgencyLevel;
    days: number;
    labelKey: string;
}

export function getDaysSinceCreation(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();

    created.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffMs = now.getTime() - created.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getTaskUrgencyInfo(createdAt: string): TaskUrgencyInfo {
    const days = getDaysSinceCreation(createdAt);

    if (days >= 30) {
        return { level: 'critical', days, labelKey: 'tasks.urgency.critical' };
    }

    if (days >= 15) {
        return { level: 'alert-2', days, labelKey: 'tasks.urgency.alert2' };
    }

    if (days >= 10) {
        return { level: 'alert-1', days, labelKey: 'tasks.urgency.alert1' };
    }

    return { level: 'normal', days, labelKey: 'tasks.urgency.normal' };
}

export function getTaskUrgencyClass(level: TaskUrgencyLevel): string {
    return `task-urgency--${level}`;
}
