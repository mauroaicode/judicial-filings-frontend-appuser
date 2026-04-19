import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { NotificationDigestHistoryResponse } from '@app/core/models/notification/notification-digest-history.model';

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
  getHistory(page: number = 1, perPage: number = 20): Observable<NotificationDigestHistoryResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    const url = `${environment.apiBaseUrl}/notification-digests/history`;

    return this._http.get<NotificationDigestHistoryResponse>(url, { params });
  }
}
