/**
 * Notification data payload (the "data" property inside the database notification)
 */
export interface NotificationData {
    title: string;
    description: string;
    type: string; // e.g., 'import-report', 'task-urgency', 'action-documents'
    id?: string;
    task_id?: string;
    task_title?: string;
    process_id?: string;
    process_number?: string;
    days_elapsed?: number;
    urgency_level?: string;
    urgency_label?: string;
    digest_id?: string;
    status?: string;
    /** Optional: deep-link into process documents accordion / viewer */
    action_id?: string;
    media_id?: number | string;
    /** Filename of the notified document (useful for viewer title before history loads) */
    original_filename?: string;
    filename?: string;
}

/**
 * Main Notification Model (Laravel structure)
 */
export interface AppNotification {
    id: string; // Database notification UUID
    type: string;
    notifiable_type: string;
    notifiable_id: string;
    data: NotificationData;
    read_at: string | null;
    opened_at?: string | null;
    created_at: string;
    created_at_human: string;
}

/**
 * Paginated notification response from API
 */
export interface NotificationResponse {
    current_page: number;
    data: AppNotification[];
    total: number;
}

/**
 * Unread count response
 */
export interface UnreadCountResponse {
    unread_count: number;
    new_count: number;
}
