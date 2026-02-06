import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import {
  OrganizationNotificationsResponse,
  OrganizationNotificationRow,
  OrganizationNotificationDetailActuacion,
  OrganizationNotificationDetailSujetoProcesal,
} from '@app/core/models/notification/organization-notification.model';

export type OrganizationNotificationType = 'actuacion' | 'sujeto_procesal' | 'actuacion_alerta';

@Injectable({
  providedIn: 'root',
})
export class OrganizationNotificationService {
  private _http = inject(HttpClient);

  /**
   * Get organization notifications by type with pagination
   */
  getNotifications(
    type: OrganizationNotificationType,
    page: number = 1,
    perPage: number = 20
  ): Observable<OrganizationNotificationsResponse> {
    const params = new HttpParams()
      .set('type', type)
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    const url = `${environment.apiBaseUrl}/organization-notifications`;
    return this._http.get<OrganizationNotificationsResponse>(url, { params });
  }

  /**
   * Mark one or more notifications as viewed.
   * PATCH organization-notifications/mark-viewed
   */
  markViewed(notificationIds: string[]): Observable<{ marked: number }> {
    const url = `${environment.apiBaseUrl}/organization-notifications/mark-viewed`;
    return this._http.patch<{ marked: number }>(url, { notification_ids: notificationIds });
  }

  /**
   * Mark all notifications as viewed, optionally filtered by type.
   * PATCH organization-notifications/mark-all-viewed?type=actuacion|actuacion_alerta|sujeto_procesal
   * If type is omitted, marks all regardless of type.
   */
  markAllViewed(type?: OrganizationNotificationType): Observable<{ marked: number }> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    const url = `${environment.apiBaseUrl}/organization-notifications/mark-all-viewed`;
    return this._http.patch<{ marked: number }>(url, {}, { params });
  }

  /**
   * Map API response data to table rows by notification type (columns differ per type).
   */
  mapToTableRows(
    type: OrganizationNotificationType,
    response: OrganizationNotificationsResponse
  ): OrganizationNotificationRow[] {
    const data = response.data ?? [];
    if (type === 'sujeto_procesal') {
      return data.map((item) => {
        const d = item.detail as OrganizationNotificationDetailSujetoProcesal;
        return {
          id: item.notification_id,
          process_id: d?.process_id ?? '',
          process_number: d?.process_number ?? '',
          subject_type: d?.subject_type ?? '',
          name_or_business_name: d?.name_or_business_name ?? '',
          identification: d?.identification ?? null,
        };
      });
    }
    // actuacion | actuacion_alerta
    return data.map((item) => {
      const d = item.detail as OrganizationNotificationDetailActuacion;
      return {
        id: item.notification_id,
        process_id: d?.process_id ?? '',
        process_number: d?.process_number ?? '',
        notification_time_human: item.notification_time_human ?? null,
        action: d?.action ?? '',
        annotation: d?.annotation ?? null,
        action_date: d?.action_date ?? '',
        registration_date: d?.registration_date ?? '',
        alert_highlights: d?.alert_highlights ?? null,
        subjects: d?.subjects ?? null,
      };
    });
  }
}
