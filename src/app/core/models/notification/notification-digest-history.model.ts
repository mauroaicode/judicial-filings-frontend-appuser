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

export interface NotificationDigestHistoryFilter {
  created_at_from?: string;
  created_at_to?: string;
  process_number?: string;
  action_date_from?: string;
  action_date_to?: string;
  term_start_date_from?: string;
  term_start_date_to?: string;
  term_end_date_from?: string;
  term_end_date_to?: string;
}

export interface NotificationDigestDetailItem {
  process_id: string | null;
  process_number: string;
  action?: string;
  action_text?: string;
  annotation: string | null;
  action_date: string;
  registration_date: string;
  plaintiff?: string;
  defendant?: string;
  plaintiffs?: string[];
  defendants?: string[];
  court?: string;
  process_class?: string;
  subclass_process?: string;
  term_start_date?: string;
  term_end_date?: string;
  lawyer_role?: string;
  alert_level?: 'red' | 'yellow' | 'green' | null;
  cons_action?: number;
  matched_keywords?: string | string[] | null;
  /** ID de la actuación (para emparejar fijación ↔ auto) */
  process_action_id?: string;
  /** La fila de fijación/notificación apunta al auto relacionado */
  notified_action_id?: string | null;
  /** La fila de auto apunta a la fijación relacionada */
  fijacion_action_id?: string | null;
  is_alert?: boolean;
  /** El backend unió fijación + auto: usar action_text + linked_action_text / linked_annotation */
  is_merged?: boolean;
  linked_action_text?: string | null;
  linked_annotation?: string | null;
  alert_highlights?: unknown[];
}

/** Fila ya fusionada para la tabla del consolidado */
export type NotificationDigestDisplayRow = NotificationDigestDetailItem & {
  related_action?: NotificationDigestDetailItem | null;
};

export interface NotificationDigestDetailResponse {
  id: string;
  data: NotificationDigestDetailItem[];
  date?: string;
  time?: string;
  period?: string;
  actions_count?: number;
  is_notified?: boolean;
  email_notified_at?: string | null;
  whatsapp_notified_at?: string | null;
  sms_notified_at?: string | null;
  created_at: string;
  email_sent_at?: string | null;
  whatsapp_sent_at?: string | null;
  sms_sent_at?: string | null;
}
