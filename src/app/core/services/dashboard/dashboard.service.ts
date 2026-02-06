import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '@app/core/config/environment.config';
import { DashboardStats } from '@app/core/models/dashboard/dashboard-stats.model';

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
  loadStats(): void {
    this._isLoading.set(true);
    this._error.set(null);

    const url = `${environment.apiBaseUrl}/dashboard/stats`;

    this._http
      .get<DashboardStats>(url)
      .pipe(
        tap({
          next: (data) => {
            this._stats.set(data);
            this._isLoading.set(false);
          },
          error: (err) => {
            this._error.set(err?.message ?? 'Error al cargar estadísticas');
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
