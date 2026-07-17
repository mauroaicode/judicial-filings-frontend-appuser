export type KnownProcessTimelineEventType =
  | 'process_became_private'
  | 'process_source_changed'
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'task_deleted'
  | 'task_restored'
  | 'process_suspended'
  | 'process_resumed'
  | 'tracking_activated'
  | 'tracking_deactivated'
  | 'semaphore_changed'
  | 'speaker_changed';

export type ProcessTimelineEventType = KnownProcessTimelineEventType | (string & {});
export type ProcessTimelineSource =
  | 'judicial_branch'
  | 'samai'
  | 'user'
  | 'system'
  | 'backfill'
  | (string & {});
export type ProcessTimelineActorType =
  | 'app_user'
  | 'admin'
  | 'job'
  | 'system'
  | (string & {});

export interface ProcessTimelineEventDisplay {
  title: string;
  summary: string | null;
  reason: string | null;
  role: string | null;
  from: string | null;
  to: string | null;
  task_type?: string | null;
  task_status?: string | null;
  source: string | null;
  actor: string | null;
  time?: string | null;
  show_technical_metadata: boolean;
}

export interface ProcessTimelineEvent {
  id: string;
  event_type: ProcessTimelineEventType;
  source: ProcessTimelineSource;
  process_id: string;
  process_number: string;
  organization_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  actor_type: ProcessTimelineActorType | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  display?: ProcessTimelineEventDisplay;
  occurred_at: string;
  recorded_at: string;
  is_backfilled: boolean;
  occurred_at_is_estimated: boolean;
}

export interface ProcessTimelineResponse {
  current_page: number;
  data: ProcessTimelineEvent[];
  last_page: number;
  next_page_url: string | null;
  per_page: number;
  total: number;
}

export interface ProcessTimelineGroup {
  key: string;
  date: Date;
  label: string;
  events: ProcessTimelineEvent[];
}
