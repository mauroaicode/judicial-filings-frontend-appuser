import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { NotificationDigestResponse, NotificationDigestFilter } from '@app/core/models/notification/notification-digest.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationDigestService {
  private _http = inject(HttpClient);

  /**
   * Get notification digests with filters and pagination
   *
   * @param filters - Filter options
   * @returns Observable with notification digests response
   */
  getNotificationDigests(filters: NotificationDigestFilter = {}): Observable<NotificationDigestResponse> {
    let params = new HttpParams();

    if (filters.page) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.per_page) {
      params = params.set('per_page', filters.per_page.toString());
    }
    if (filters.process_number) {
      params = params.set('process_number', filters.process_number);
    }
    if (filters.registration_date_from) {
      params = params.set('registration_date_from', filters.registration_date_from);
    }
    if (filters.registration_date_to) {
      params = params.set('registration_date_to', filters.registration_date_to);
    }
    if (filters.action_date_from) {
      params = params.set('action_date_from', filters.action_date_from);
    }
    if (filters.action_date_to) {
      params = params.set('action_date_to', filters.action_date_to);
    }
    if (filters.term_start_date_from) {
      params = params.set('term_start_date_from', filters.term_start_date_from);
    }
    if (filters.term_start_date_to) {
      params = params.set('term_start_date_to', filters.term_start_date_to);
    }
    if (filters.term_end_date_from) {
      params = params.set('term_end_date_from', filters.term_end_date_from);
    }
    if (filters.term_end_date_to) {
      params = params.set('term_end_date_to', filters.term_end_date_to);
    }
    if (filters.created_at_from) {
      params = params.set('created_at_from', filters.created_at_from);
    }
    if (filters.created_at_to) {
      params = params.set('created_at_to', filters.created_at_to);
    }

    const url = `${environment.apiBaseUrl}/notification-digests`;

    return this._http.get<NotificationDigestResponse>(url, { params });
  }
}
