/**
 * Process Instance - Una instancia dentro de un proceso (mismo radicado, otro despacho)
 */
export interface ProcessInstance {
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
  term_start_date?: string | null;
  term_end_date?: string | null;
  plaintiff: string | null;
  defendant: string | null;
  plaintiffs?: string[];
  defendants?: string[];
}

/**
 * Process Model - Based on API response (una fila por radicado; puede incluir instancias)
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
  term_start_date?: string | null;
  term_end_date?: string | null;
  /** Lista completa de demandantes (para tooltip) */
  plaintiffs?: string[];
  /** Lista completa de demandados (para tooltip) */
  defendants?: string[];
  /** Instancias del mismo radicado (expandible en la tabla) */
  instances?: ProcessInstance[];
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

/**
 * Process Detail - Full process information
 */
export interface ProcessDetail {
  id: string;
  process_id: number;
  process_number: string;
  court: string;
  speaker?: string | null;
  department: string;
  process_type: string;
  process_class: string;
  subclass_process: string;
  litigants: string | null;
  process_date: string;
  last_activity_date: string | null;
  location: string;
  filing_content: string | null;
  is_private: boolean;
  has_multiple_instances: boolean;
  last_api_update: string;
  status_label: string;
  created_at: string;
  updated_at: string;
}

/**
 * Process instance summary for detail view selector (GET /processes/:id/instances)
 */
export interface ProcessDetailInstance {
  id: string;
  court: string;
  actions_count: number;
  last_api_update: string;
  status_label: string;
}

/**
 * Subject - Process subject (Demandante/Demandado)
 */
export interface Subject {
  id: string;
  subject_registration_id: number;
  subject_type: string; // 'Demandante' | 'Demandado'
  is_cited: boolean;
  identification: string | null;
  name_or_business_name: string;
}

/**
 * Process Detail Response
 */
export interface ProcessDetailResponse {
  process: ProcessDetail;
  subjects: Subject[];
}

/**
 * Range to highlight inside annotation (keyword match from API)
 */
export interface AlertHighlight {
  start: number;
  end: number;
  text: string;
  source?: string; // 'action' or 'annotation'
}

/**
 * Action - Process action/actuación
 */
export interface Action {
  index?: number;
  id: string;
  action_registration_id?: number;
  cons_action?: number;
  action_date: string;
  registration_date: string;
  action: string;
  annotation: string | null;
  term_start_date?: string | null;
  term_end_date?: string | null;
  court?: string;
  created_at?: string;
  updated_at?: string;
  /** Optional: ranges to highlight in annotation (e.g. keywords like "Sentencia") */
  alert_highlights?: AlertHighlight[] | null;
}

/**
 * Alert keyword for filtering actions (from GET processes/:id/alert-keywords)
 */
export interface AlertKeyword {
  id: string;
  name: string;
  slug: string;
}

export interface AlertKeywordsResponse {
  data: AlertKeyword[];
}

/**
 * Alert keyword with count (from GET processes/:id/alert-keyword-stats)
 */
export interface AlertKeywordStat {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface AlertKeywordStatsResponse {
  data: AlertKeywordStat[];
}

/**
 * Action Filter Options
 */
export interface ActionFilter {
  action_date_from?: string;
  action_date_to?: string;
  registration_date_from?: string;
  registration_date_to?: string;
  /** Filtrar por tipo de alerta (slug del keyword) */
  alert_slug?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

/**
 * Action Response from API (Laravel Pagination)
 */
export interface ActionResponse {
  current_page: number;
  data: Action[];
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
 * Action Response Meta (simplified for component usage)
 */
export interface ActionResponseMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}
