export interface ProcessImportHistoryItem {
  id: string;
  file_name?: string | null;
  total_count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  multiple_instances_count?: number | null;
  status?: string | null;
  status_label?: string | null;
  enqueued_process_numbers?: string[] | null;
  completed_at?: string | null;
  created_at?: string | null;

  // Campos alternos para respuestas resumidas
  date?: string | null;
  time?: string | null;
  period?: string | null;
  actions_count?: number | null;
  is_notified?: boolean | null;
  email_notified_at?: string | null;
  whatsapp_notified_at?: string | null;
  sms_notified_at?: string | null;
}

export interface ProcessImportHistoryResponse {
  current_page: number;
  data: ProcessImportHistoryItem[];
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

export interface ProcessImportHistoryMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}
