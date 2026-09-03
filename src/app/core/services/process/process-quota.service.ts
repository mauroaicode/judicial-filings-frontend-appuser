import { computed, inject, Injectable, signal } from '@angular/core';
import { ProcessService } from '@app/core/services/process/process.service';
import { OrganizationProcessQuota } from '@app/core/models/process/process.model';

export type ProcessQuotaTone = 'info' | 'warning' | 'error';

@Injectable({
  providedIn: 'root',
})
export class ProcessQuotaService {
  private _processService = inject(ProcessService);

  private _quota = signal<OrganizationProcessQuota | null>(null);
  private _isLoading = signal(false);

  readonly quota = this._quota.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  /** True unless the API explicitly says the org cannot add another process. */
  readonly canAddProcess = computed(() => this._quota()?.can_add_process !== false);

  readonly isAtLimit = computed(() => this._quota()?.is_at_limit === true);
  readonly isUnlimited = computed(() => this._quota()?.is_unlimited === true);

  readonly usagePercent = computed(() => {
    const q = this._quota();
    if (!q || q.is_unlimited || q.max_active_processes == null || q.max_active_processes <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((q.active_processes_count / q.max_active_processes) * 100));
  });

  readonly tone = computed<ProcessQuotaTone>(() => {
    const q = this._quota();
    if (!q || q.is_unlimited) {
      return 'info';
    }
    if (q.is_at_limit) {
      return 'error';
    }
    if (this.usagePercent() >= 80) {
      return 'warning';
    }
    return 'info';
  });

  loadQuota(): void {
    this._isLoading.set(true);
    this._processService.getProcessQuota().subscribe({
      next: (data) => {
        this._quota.set(data);
        this._isLoading.set(false);
      },
      error: () => {
        this._isLoading.set(false);
      },
    });
  }
}
