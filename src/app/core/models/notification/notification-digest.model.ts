/**
 * Movement (Actuación) inside a digest
 */
export interface Movement {
  id?: string;
  process_id?: string;
  court: string;
  is_alert: boolean;
  annotation: string;
  action_date: string;
  action_text: string;
  process_number: string;
  matched_keywords: string | null;
  registration_date: string;
  plaintiff: string; // The text representation
  defendant: string; // The text representation
  plaintiffs: string[]; // Actual list
  defendants: string[]; // Actual list
  term_start_date?: string | null;
  term_end_date?: string | null;
  alert_highlights?: Array<{ start: number; end: number; text: string; source: string }>;
  alert_level?: 'red' | 'yellow' | 'green' | null;
  lawyer_role?: string | null;
  is_viewed?: boolean;
  digest_created_at?: string;
  [key: string]: any; 
}

/**
 * Single Digest (Notification Group)
 */
export interface NotificationDigest {
  id: string;
  data: Movement[];
  created_at: string;
  email_sent_at: string | null;
  whatsapp_sent_at: string | null;
  sms_sent_at: string | null;
}

/**
 * Filter for notification digests
 */
export interface NotificationDigestFilter {
  process_number?: string;
  registration_date_from?: string;
  registration_date_to?: string;
  action_date_from?: string;
  action_date_to?: string;
  term_start_date_from?: string;
  term_start_date_to?: string;
  term_end_date_from?: string;
  term_end_date_to?: string;
  created_at_from?: string;
  created_at_to?: string;
  per_page?: number;
  page?: number;
}

/**
 * Paginated response for notification digests
 */
export interface NotificationDigestResponse {
  current_page: number;
  data: NotificationDigest[];
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
