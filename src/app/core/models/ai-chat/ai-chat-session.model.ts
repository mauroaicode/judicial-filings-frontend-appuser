export interface AiChatSession {
    id: string;
    title: string;
    is_private: boolean;
    created_at: string;
    diff_for_humans: string;
    app_user_name: string;
}
