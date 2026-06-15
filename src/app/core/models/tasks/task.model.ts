export type TaskStatus = 'pending' | 'draft' | 'completed';
export type TaskView = TaskStatus | 'trash';

export interface Task {
    id: string;
    title: string;
    description: string;
    due_date: string | null;
    reminder_days: number | null;
    status: TaskStatus;
    status_label: string;
    process_id: string | null;
    process_number: string | null;
    is_admin: boolean;
    organization_id: string;
    created_at: string;
    deleted_at?: string | null;
}

export interface TaskPagination {
    current_page: number;
    data: Task[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface TaskCreateRequest {
    title: string;
    description: string;
    due_date?: string | null;
    reminder_days?: number | null;
    status?: TaskStatus;
    is_admin: boolean;
    organization_id: string;
    process_id?: string | null;
}

export interface TaskUpdateRequest {
    title: string;
    description: string;
    due_date?: string | null;
    reminder_days?: number | null;
    is_admin: boolean;
    organization_id: string;
    process_id?: string | null;
}

export interface TaskStatusUpdateRequest {
    status: TaskStatus;
}

export interface TaskStatusOption {
    value: TaskStatus;
    label: string;
}

export interface ProcessSummary {
    id: string;
    number: string;
    despacho: string;
}
