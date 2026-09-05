import {
  KnownProcessTimelineEventType,
  ProcessTimelineEvent,
} from '@app/core/models/process/process-timeline.model';

export type TimelineTone = 'neutral' | 'muted' | 'info' | 'warning' | 'success' | 'dynamic';
export type TimelineTranslator = (
  key: string,
  params?: Record<string, string | number>
) => string;

export interface TimelineDetail {
  label: string;
  value: string;
}

export interface TimelineSemaphorePresentation {
  from: string | null;
  to: string | null;
  fromLabel: string | null;
  toLabel: string | null;
}

export interface TimelineEventPresentation {
  title: string;
  description: string;
  iconPath: string;
  tone: TimelineTone;
  actor: string | null;
  source: string | null;
  details: TimelineDetail[];
  semaphore: TimelineSemaphorePresentation | null;
}

interface TimelinePresentationConfig {
  titleKey: string;
  iconPath: string;
  tone: TimelineTone;
}

const ICONS = {
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  arrows: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5M16.5 3 21 7.5m0 0L16.5 12M21 7.5H7.5',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3.75 9.75h16.5m-15 12h13.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6.75V19.5a2.25 2.25 0 002.25 2.25z',
  pencil: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z',
  check: 'M9 12.75 11.25 15 15 9.75m6-3.75A11.95 11.95 0 0112 2.25 11.95 11.95 0 013 6c0 5.59 3.824 10.29 9 11.62 5.176-1.33 9-6.03 9-11.62z',
  trash: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0H4.772m10.978 0v-.916a2.25 2.25 0 00-2.25-2.25h-3a2.25 2.25 0 00-2.25 2.25v.916',
  restore: 'M9 15 3 9m0 0 6-6M3 9h12a6 6 0 010 12h-3',
  pause: 'M15.75 5.25v13.5m-7.5-13.5v13.5',
  play: 'M5.25 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L8.029 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653z',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  eyeOff: 'M3.98 8.223A10.477 10.477 0 002.036 12.322c1.387 4.172 5.324 7.178 9.964 7.178 1.862 0 3.61-.484 5.127-1.333M6.228 6.228A10.451 10.451 0 0112 4.5c4.638 0 8.573 3.007 9.963 7.178a10.522 10.522 0 01-1.293 2.573M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88',
  semaphore: 'M9 2.75h6a2.25 2.25 0 012.25 2.25v14A2.25 2.25 0 0115 21.25H9A2.25 2.25 0 016.75 19V5A2.25 2.25 0 019 2.75z M12 7.75a1 1 0 100-2 1 1 0 000 2z M12 13a1 1 0 100-2 1 1 0 000 2z M12 18.25a1 1 0 100-2 1 1 0 000 2z',
  user: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3M13.5 6.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM3.75 20.105a8.25 8.25 0 0110.5 0',
  fallback: 'M11.25 11.25 11.25 6.75m0 8.25h.008v.008h-.008V15z M12 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12 6.615 2.25 12 2.25z',
} as const;

export const PROCESS_TIMELINE_PRESENTATION: Record<
  KnownProcessTimelineEventType,
  TimelinePresentationConfig
> = {
  process_became_private: { titleKey: 'private', iconPath: ICONS.lock, tone: 'warning' },
  process_source_changed: { titleKey: 'sourceChanged', iconPath: ICONS.arrows, tone: 'info' },
  task_created: { titleKey: 'taskCreated', iconPath: ICONS.calendar, tone: 'neutral' },
  task_updated: { titleKey: 'taskUpdated', iconPath: ICONS.pencil, tone: 'neutral' },
  task_status_changed: { titleKey: 'taskStatusChanged', iconPath: ICONS.check, tone: 'neutral' },
  task_deleted: { titleKey: 'taskDeleted', iconPath: ICONS.trash, tone: 'muted' },
  task_restored: { titleKey: 'taskRestored', iconPath: ICONS.restore, tone: 'neutral' },
  process_suspended: { titleKey: 'suspended', iconPath: ICONS.pause, tone: 'warning' },
  process_resumed: { titleKey: 'resumed', iconPath: ICONS.play, tone: 'success' },
  tracking_activated: { titleKey: 'trackingActivated', iconPath: ICONS.eye, tone: 'success' },
  tracking_deactivated: { titleKey: 'trackingDeactivated', iconPath: ICONS.eyeOff, tone: 'muted' },
  semaphore_changed: { titleKey: 'semaphoreChanged', iconPath: ICONS.semaphore, tone: 'dynamic' },
  speaker_changed: { titleKey: 'speakerChanged', iconPath: ICONS.user, tone: 'info' },
};

const FALLBACK_CONFIG: TimelinePresentationConfig = {
  titleKey: 'unknown',
  iconPath: ICONS.fallback,
  tone: 'neutral',
};

export function presentTimelineEvent(
  event: ProcessTimelineEvent,
  translate: TimelineTranslator,
  locale: string
): TimelineEventPresentation {
  const config =
    PROCESS_TIMELINE_PRESENTATION[event.event_type as KnownProcessTimelineEventType] ??
    FALLBACK_CONFIG;
  const payload = event.payload;
  const details: TimelineDetail[] = [];
  let description = translate('processDetail.timeline.descriptions.unknown');
  let semaphore: TimelineSemaphorePresentation | null = null;

  switch (event.event_type) {
    case 'process_became_private':
      description = translate('processDetail.timeline.descriptions.private');
      break;
    case 'process_source_changed': {
      const from = sourceLabel(nestedString(payload, 'from', 'data_source'), translate);
      const to = sourceLabel(nestedString(payload, 'to', 'data_source'), translate);
      description = translate('processDetail.timeline.descriptions.sourceChanged', { from, to });
      pushDetail(details, translate('processDetail.timeline.fields.corporation'), nestedString(payload, 'to', 'samai_corporacion'));
      break;
    }
    case 'task_created':
      description = stringValue(payload['title']) || translate('processDetail.timeline.descriptions.taskCreated');
      pushDetail(details, translate('processDetail.timeline.fields.type'), event.display?.task_type ?? null);
      pushDetail(details, translate('processDetail.timeline.fields.status'), event.display?.task_status ?? null);
      pushDetail(details, translate('processDetail.timeline.fields.dueDate'), formatDate(stringValue(payload['due_date']), locale));
      pushDetail(details, translate('processDetail.timeline.fields.reminder'), reminderValue(payload['reminder_days'], translate));
      break;
    case 'task_updated':
      description = taskChangesDescription(payload['changes'], translate, locale);
      break;
    case 'task_status_changed':
      description = translate('processDetail.timeline.descriptions.taskStatusChanged', {
        from: displayValue(payload['from'], translate),
        to: displayValue(payload['to'], translate),
      });
      pushDetail(details, translate('processDetail.timeline.fields.type'), event.display?.task_type ?? null);
      break;
    case 'task_deleted':
      description = translate('processDetail.timeline.descriptions.taskDeleted');
      break;
    case 'task_restored':
      description = translate('processDetail.timeline.descriptions.taskRestored');
      break;
    case 'process_suspended':
      description = translate(
        truthy(payload['semaphore_paused'])
          ? 'processDetail.timeline.descriptions.suspendedPaused'
          : 'processDetail.timeline.descriptions.suspended'
      );
      pushDetail(
        details,
        translate('processDetail.timeline.fields.transition'),
        displayTransition(event, payload, translate)
      );
      pushDetail(
        details,
        translate('processDetail.timeline.fields.reason'),
        event.display?.reason ?? humanize(stringValue(payload['reason']))
      );
      if (event.subject_type === 'task') {
        pushDetail(
          details,
          translate('processDetail.timeline.fields.relatedTask'),
          stringValue(payload['task_title']) ?? stringValue(payload['title'])
        );
      }
      break;
    case 'process_resumed':
      description = translate('processDetail.timeline.descriptions.resumed');
      pushDetail(
        details,
        translate('processDetail.timeline.fields.reason'),
        event.display?.reason ?? humanize(stringValue(payload['reason']))
      );
      if (event.subject_type === 'task') {
        pushDetail(
          details,
          translate('processDetail.timeline.fields.relatedTask'),
          stringValue(payload['task_title']) ?? stringValue(payload['title'])
        );
      }
      break;
    case 'tracking_activated':
      description = translate('processDetail.timeline.descriptions.trackingActivated');
      break;
    case 'tracking_deactivated':
      description = translate('processDetail.timeline.descriptions.trackingDeactivated');
      break;
    case 'semaphore_changed': {
      const from = semaphoreLevel(payload['from']);
      const to = semaphoreLevel(payload['to']);
      semaphore = {
        from,
        to,
        fromLabel: event.display?.from ?? null,
        toLabel: event.display?.to ?? null,
      };
      description = semaphoreDescription(from, to, payload, translate);
      pushDetail(
        details,
        translate('processDetail.timeline.fields.reason'),
        event.display?.reason ?? humanize(stringValue(payload['reason']))
      );
      pushDetail(
        details,
        translate('processDetail.timeline.fields.role'),
        event.display?.role ?? stringValue(payload['lawyer_role'])
      );
      pushDisplayDates(details, event);
      pushDetail(details, translate('processDetail.timeline.fields.persistedLevel'), semaphoreLevel(payload['stored_level_after_reset']));
      break;
    }
    case 'speaker_changed':
      description = translate('processDetail.timeline.descriptions.speakerChanged', {
        from: displayValue(payload['from'], translate),
        to: displayValue(payload['to'], translate),
      });
      pushDisplayDates(details, event);
      break;
  }

  return {
    title: event.display?.title || translate(`processDetail.timeline.titles.${config.titleKey}`),
    description: event.display?.summary || description,
    iconPath: config.iconPath,
    tone: config.tone,
    actor: event.display?.actor ?? actorLabel(event.actor_type, translate),
    source: event.display?.source ?? null,
    details,
    semaphore,
  };
}

function pushDisplayDates(details: TimelineDetail[], event: ProcessTimelineEvent): void {
  const dates = event.display?.dates;
  if (!dates?.length) return;

  for (const date of dates) {
    pushDetail(details, date.label, date.formatted);
  }
}

function displayTransition(
  event: ProcessTimelineEvent,
  payload: Record<string, unknown>,
  translate: TimelineTranslator
): string | null {
  if (event.display?.from || event.display?.to) {
    return `${event.display.from ?? '–'} → ${event.display.to ?? '–'}`;
  }
  return transitionValue(payload, translate);
}

function semaphoreDescription(
  from: string | null,
  to: string | null,
  payload: Record<string, unknown>,
  translate: TimelineTranslator
): string {
  if (truthy(payload['paused']) || stringValue(payload['reason'])?.includes('suspension')) {
    return translate('processDetail.timeline.descriptions.semaphorePaused');
  }
  if (to === 'red') {
    return translate('processDetail.timeline.descriptions.semaphoreRed');
  }
  return translate('processDetail.timeline.descriptions.semaphoreChanged', {
    from: semaphoreLabel(from, translate),
    to: semaphoreLabel(to, translate),
  });
}

function taskChangesDescription(
  value: unknown,
  translate: TimelineTranslator,
  locale: string
): string {
  if (!isRecord(value)) return translate('processDetail.timeline.descriptions.taskUpdated');
  const dueDate = value['due_date'];
  if (isRecord(dueDate)) {
    return translate('processDetail.timeline.descriptions.dueDateChanged', {
      from: formatDate(stringValue(dueDate['from']), locale) ?? '–',
      to: formatDate(stringValue(dueDate['to']), locale) ?? '–',
    });
  }
  const fields = Object.keys(value).map(humanize).join(', ');
  return fields
    ? translate('processDetail.timeline.descriptions.fieldsChanged', { fields })
    : translate('processDetail.timeline.descriptions.taskUpdated');
}

function transitionValue(
  payload: Record<string, unknown>,
  translate: TimelineTranslator
): string | null {
  const from = displayValue(payload['from'], translate);
  const to = displayValue(payload['to'], translate);
  return from === '–' && to === '–' ? null : `${from} → ${to}`;
}

function displayValue(value: unknown, translate: TimelineTranslator): string {
  if (isRecord(value)) {
    return stringValue(value['status']) ?? stringValue(value['title']) ?? '–';
  }
  return stringValue(value) ?? translate('processDetail.timeline.notAvailable');
}

function semaphoreLevel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  let raw: string | null = null;
  if (isRecord(value)) {
    raw = stringValue(value['level']) ?? stringValue(value['alert_level']);
  } else {
    raw = stringValue(value);
  }
  return normalizeSemaphoreLevel(raw);
}

/** Maps API/display labels to canonical alert levels used by UI dots. */
function normalizeSemaphoreLevel(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (['red', 'rojo', 'r', 'critical'].includes(v)) return 'red';
  if (['yellow', 'amarillo', 'y', 'amber', 'warning'].includes(v)) return 'yellow';
  if (['green', 'verde', 'g', 'ok', 'success'].includes(v)) return 'green';
  if (
    ['none', 'null', 'n/a', 'sin nivel', 'sin nivel anterior', 'sin_nivel', 'unknown'].includes(v)
  ) {
    return null;
  }
  return null;
}

function semaphoreLabel(value: string | null, translate: TimelineTranslator): string {
  return translate(`processDetail.timeline.semaphore.${value ?? 'none'}`);
}

function sourceLabel(value: string | null, translate: TimelineTranslator): string {
  if (value === 'judicial_branch' || value === 'samai') {
    return translate(`processDetail.timeline.sources.${value}`);
  }
  return value ?? translate('processDetail.timeline.notAvailable');
}

function actorLabel(
  actorType: ProcessTimelineEvent['actor_type'],
  translate: TimelineTranslator
): string | null {
  if (!actorType) return null;
  const known = ['app_user', 'admin', 'job', 'system'].includes(actorType);
  return translate(`processDetail.timeline.actors.${known ? actorType : 'unknown'}`);
}

function reminderValue(value: unknown, translate: TimelineTranslator): string | null {
  return typeof value === 'number'
    ? translate('processDetail.timeline.reminderDays', { count: value })
    : null;
}

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function nestedString(
  record: Record<string, unknown>,
  parent: string,
  child: string
): string | null {
  const nested = record[parent];
  return isRecord(nested) ? stringValue(nested[child]) : null;
}

function pushDetail(details: TimelineDetail[], label: string, value: string | null): void {
  if (value) details.push({ label, value });
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === 'true';
}

function humanize(value: string | null): string | null {
  if (!value) return null;
  const result = value.replaceAll('_', ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
