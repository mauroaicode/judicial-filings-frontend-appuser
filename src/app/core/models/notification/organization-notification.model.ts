/**
 * Range to highlight inside annotation text (keyword match)
 */
export interface AlertHighlight {
  start: number;
  end: number;
  text: string;
}

/**
 * Subject (sujeto procesal) in an actuación notification
 */
export interface OrganizationNotificationSubject {
  name: string;
  type: string;
}

/**
 * Detail for notification types: actuación, actuación alerta
 */
export interface OrganizationNotificationDetailActuacion {
  process_id: string;
  process_number: string;
  action: string;
  annotation: string | null;
  action_date: string;
  registration_date: string;
  /** Optional: ranges to highlight in annotation (e.g. keywords like "Sentencia") */
  alert_highlights?: AlertHighlight[] | null;
  /** Sujetos procesales (demandante, demandado, vinculado, etc.) */
  subjects?: OrganizationNotificationSubject[] | null;
}

/**
 * Detail for notification type: sujeto_procesal
 */
export interface OrganizationNotificationDetailSujetoProcesal {
  process_id: string;
  process_number: string;
  subject_type: string;
  name_or_business_name: string;
  identification: string | null;
}

/** Union of all detail shapes from API */
export type OrganizationNotificationDetail =
  | OrganizationNotificationDetailActuacion
  | OrganizationNotificationDetailSujetoProcesal;

/**
 * Single notification item from API (detail shape depends on notification_type)
 */
export interface OrganizationNotificationItem {
  notification_id: string;
  /** Human-readable relative time, e.g. "hace 1 hora" */
  notification_time_human?: string | null;
  detail: OrganizationNotificationDetail;
}

/**
 * Pagination meta from API
 */
export interface OrganizationNotificationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/**
 * Response from GET organization-notifications?type=
 */
export interface OrganizationNotificationsResponse {
  notification_type: 'actuacion' | 'sujeto_procesal' | 'actuacion_alerta';
  data: OrganizationNotificationItem[];
  meta: OrganizationNotificationMeta;
}

/**
 * Generic table row: id + process_number always; rest depends on notification type.
 * Actuación/actuacion_alerta: action, annotation, action_date, registration_date, subjects, notification_time_human.
 * Sujeto_procesal: subject_type, name_or_business_name, identification.
 */
export interface OrganizationNotificationRow {
  id: string;
  process_id: string;
  process_number: string;
  /** When the user was notified (e.g. "hace 1 hora") */
  notification_time_human?: string | null;
  // Actuación / actuacion_alerta
  action?: string;
  annotation?: string | null;
  action_date?: string;
  registration_date?: string;
  alert_highlights?: AlertHighlight[] | null;
  subjects?: OrganizationNotificationSubject[] | null;
  // Sujeto_procesal
  subject_type?: string;
  name_or_business_name?: string;
  identification?: string | null;
}
