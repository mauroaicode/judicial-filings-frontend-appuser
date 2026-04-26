import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { NotificationDigestHistoryResponse, NotificationDigestDetailResponse } from '@app/core/models/notification/notification-digest-history.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationDigestHistoryService {
  private _http = inject(HttpClient);

  /**
   * Get notification digest history with pagination
   * 
   * @param page - Page number
   * @param perPage - Items per page
   * @returns Observable with notification digest history response
   */
  getHistory(
    page: number = 1,
    perPage: number = 20,
    filters?: import('@app/core/models/notification/notification-digest-history.model').NotificationDigestHistoryFilter
  ): Observable<NotificationDigestHistoryResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (filters) {
      if (filters.created_at_from) params = params.set('created_at_from', filters.created_at_from);
      if (filters.created_at_to) params = params.set('created_at_to', filters.created_at_to);
      if (filters.process_number) params = params.set('process_number', filters.process_number);
      if (filters.action_date_from) params = params.set('action_date_from', filters.action_date_from);
      if (filters.action_date_to) params = params.set('action_date_to', filters.action_date_to);
      if (filters.term_start_date_from) params = params.set('term_start_date_from', filters.term_start_date_from);
      if (filters.term_start_date_to) params = params.set('term_start_date_to', filters.term_start_date_to);
      if (filters.term_end_date_from) params = params.set('term_end_date_from', filters.term_end_date_from);
      if (filters.term_end_date_to) params = params.set('term_end_date_to', filters.term_end_date_to);
    }

    const url = `${environment.apiBaseUrl}/notification-digests/history`;

    return this._http.get<NotificationDigestHistoryResponse>(url, { params });
  }

  /**
   * Retrieves details for a specific notification digest (paginado: page, per_page).
   */
  public getDigestDetails(
    id: string,
    page: number = 1,
    perPage: number = 20
  ): Observable<NotificationDigestDetailResponse> {
    const url = `${environment.apiBaseUrl}/notification-digests/${id}`;
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));
    return this._http.get<NotificationDigestDetailResponse>(url, { params });
  }
}
