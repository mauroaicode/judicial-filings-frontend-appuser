export interface Task {
    id: string;
    title: string;
    description: string;
    process_id: string | null;
    process_number: string | null;
    is_admin: boolean;
    organization_id: string;
    created_at: string;
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
    is_admin: boolean;
    organization_id: string;
    process_id?: string | null;
}

export interface ProcessSummary {
    id: string;
    number: string;
    despacho: string;
}
