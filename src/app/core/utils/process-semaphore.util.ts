import { ProcessSemaphore } from '@app/core/models/process/process.model';

export function isSemaphorePaused(
  semaphore: ProcessSemaphore | null | undefined
): boolean {
  return !!semaphore?.paused;
}

export function getSemaphorePauseMessage(
  semaphore: ProcessSemaphore | null | undefined,
  fallback = ''
): string {
  if (!isSemaphorePaused(semaphore)) {
    return '';
  }
  return (semaphore?.message ?? '').trim() || fallback;
}
