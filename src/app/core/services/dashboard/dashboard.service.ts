import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '@app/core/config/environment.config';
import { DashboardStats } from '@app/core/models/dashboard/dashboard-stats.model';
import { ProcessFilter } from '@app/core/models/process/process.model';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private _http = inject(HttpClient);

  private _stats = signal<DashboardStats | null>(null);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);

  readonly stats = this._stats.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasStats = computed(() => this._stats() !== null);
  readonly notificationsByType = computed(() => {
    const s = this._stats();
    return s?.notifications?.by_type ?? { actuacion: 0, actuacion_alerta: 0 };
  });

  /**
   * Load dashboard stats from GET dashboard/stats
   */
  loadStats(filters: ProcessFilter = {}): void {
    this._isLoading.set(true);
    this._error.set(null);

    const url = `${environment.apiBaseUrl}/dashboard/stats`;
    let params = new HttpParams();

    if (filters.process_number) params = params.set('process_number', filters.process_number);
    if (filters.court) params = params.set('court', filters.court);
    if (filters.process_class) params = params.set('process_class', filters.process_class);
    if (filters.plaintiff) params = params.set('plaintiff', filters.plaintiff);
    if (filters.defendant) params = params.set('defendant', filters.defendant);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.has_multiple_instances !== undefined && filters.has_multiple_instances !== null) {
      params = params.set('has_multiple_instances', String(filters.has_multiple_instances));
    }
    if (filters.process_date_from) params = params.set('process_date_from', filters.process_date_from);
    if (filters.process_date_to) params = params.set('process_date_to', filters.process_date_to);
    if (filters.created_at_from) params = params.set('created_at_from', filters.created_at_from);
    if (filters.created_at_to) params = params.set('created_at_to', filters.created_at_to);
    if (filters.last_api_update_from) params = params.set('last_api_update_from', filters.last_api_update_from);
    if (filters.last_api_update_to) params = params.set('last_api_update_to', filters.last_api_update_to);
    if (filters.lawyer_role) params = params.set('lawyer_role', filters.lawyer_role);
    if (filters.severity_color) params = params.set('severity_color', filters.severity_color);

    this._http
      .get<DashboardStats>(url, { params })
      .pipe(
        tap({
          next: (data) => {
            this._stats.set(data);
            this._isLoading.set(false);
          },
          error: (err) => {
            let errorMsg = 'Error al cargar estadísticas';
            if (err.error?.messages && Array.isArray(err.error.messages)) {
              errorMsg = err.error.messages.join('. ');
            } else if (err.error?.errors) {
              // Standard Laravel validation errors (Object with arrays)
              const allErrors = Object.values(err.error.errors).flat();
              errorMsg = allErrors.join('. ');
            } else if (err.error?.message) {
              errorMsg = err.error.message;
            } else if (err.message) {
              errorMsg = err.message;
            }
            this._error.set(errorMsg);
            this._isLoading.set(false);
          },
        })
      )
      .subscribe();
  }

  /**
   * Clear stats and error (e.g. on logout)
   */
  clearStats(): void {
    this._stats.set(null);
    this._error.set(null);
  }
}
