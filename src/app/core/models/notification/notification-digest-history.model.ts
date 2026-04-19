export interface NotificationDigestHistory {
  id: string;
  date: string;
  time: string;
  period: string; // 'Mañana', 'Tarde', 'Noche'
  actions_count: number;
  is_notified: boolean;
  email_notified_at: string | null;
  whatsapp_notified_at: string | null;
  sms_notified_at: string | null;
}

export interface NotificationDigestHistoryResponse {
  current_page: number;
  data: NotificationDigestHistory[];
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
