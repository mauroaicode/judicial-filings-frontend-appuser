/**
 * Process Model - Based on API response
 */
export interface Process {
  id: string;
  process_number: string;
  court: string;
  department: string;
  process_type: string;
  process_class: string;
  subclass_process: string;
  process_date: string;
  last_activity_date: string;
  location: string;
  is_private: boolean;
  has_multiple_instances: boolean;
  status_label: string;
  created_at: string;
}

/**
 * Process Filter Options
 */
export interface ProcessFilter {
  process_number?: string;
  court?: string;
  department?: string;
  process_type?: string;
  process_class?: string;
  location?: string;
  status?: string; // 'active' | 'inactive'
  is_private?: boolean;
  has_multiple_instances?: boolean;
  process_date_from?: string;
  process_date_to?: string;
  created_at_from?: string;
  created_at_to?: string;
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
