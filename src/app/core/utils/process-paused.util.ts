import { TaskType } from '@app/core/models/tasks/task.model';

/** Process pivot statuses that pause the inactivity semaphore. */
export const PROCESS_PAUSED_STATUS_CODES = [
  'pending_hearing',
  'suspended_insolvency',
  'suspended_payment_agreement',
  'suspended',
] as const;

export type ProcessPausedStatusCode = (typeof PROCESS_PAUSED_STATUS_CODES)[number];

/** Agenda task types that pause a related process. */
export const PROCESS_PAUSING_TASK_TYPES: readonly TaskType[] = [
  'pending_hearing',
  'suspension_insolvency',
  'suspension_payment_agreement',
  'suspension',
];

export function isPausedProcessStatusCode(
  status: string | null | undefined
): boolean {
  if (!status) return false;
  return (PROCESS_PAUSED_STATUS_CODES as readonly string[]).includes(status);
}

/**
 * Heuristic for status_label when status code is unavailable.
 */
export function isPausedProcessStatusLabel(
  label: string | null | undefined
): boolean {
  const value = (label ?? '').toLowerCase();
  if (!value) return false;
  return (
    value.includes('suspend') ||
    value.includes('audiencia') ||
    value.includes('hearing') ||
    value.includes('insolv') ||
    value.includes('acuerdo de pago') ||
    value.includes('payment agreement')
  );
}

export function isProcessPaused(
  statusCode?: string | null,
  statusLabel?: string | null
): boolean {
  return (
    isPausedProcessStatusCode(statusCode) ||
    isPausedProcessStatusLabel(statusLabel)
  );
}

export function isProcessPausingTaskType(
  type: string | null | undefined
): boolean {
  return !!type && (PROCESS_PAUSING_TASK_TYPES as readonly string[]).includes(type);
}
