/**
 * Process Model - Based on API response
 */
export interface Process {
  index: number;
  id: string;
  process_number: string;
  court: string;
  process_class: string;
  subclass_process: string;
  process_date: string;
  last_activity_date: string | null;
  is_private: boolean;
  has_multiple_instances: boolean;
  status_label: string;
  created_at: string;
  plaintiff: string | null;
  defendant: string | null;
}

/**
 * Process Filter Options
 */
export interface ProcessFilter {
  process_number?: string;
  court?: string;
  process_class?: string;
  plaintiff?: string;
  defendant?: string;
  status?: string; // 'active' | 'inactive'
  has_multiple_instances?: boolean;
  process_date_from?: string;
  process_date_to?: string;
  created_at_from?: string;
  created_at_to?: string;
  last_api_update_from?: string;
  last_api_update_to?: string;
  page?: number;
  per_page?: number;
}

/**
 * Laravel Pagination Link
 */
export interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

/**
 * Process Response from API (Laravel Pagination)
 */
export interface ProcessResponse {
  current_page: number;
  data: Process[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: PaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

/**
 * Process Response Meta (simplified for component usage)
 */
export interface ProcessResponseMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}

/**
 * Create Process Response
 */
export interface CreateProcessResponse {
  message: string;
  has_multiple_instances: boolean;
  total_processes: number;
  registered_count: number;
  private_count: number;
  process: Process;
}
