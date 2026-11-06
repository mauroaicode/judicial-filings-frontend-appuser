import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import {
  OrganizationNotificationChannel,
  OrganizationNotificationChannelLimits,
  OrganizationNotificationChannelsResponse,
  StoreNotificationChannelPayload,
  UpdateNotificationChannelPayload,
} from '@app/core/models/notification-channel/notification-channel.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationChannelService {
  private _httpClient = inject(HttpClient);
  private _baseUrl = `${environment.apiBaseUrl}/config/notification-channels`;

  list(): Observable<OrganizationNotificationChannelsResponse> {
    return this._httpClient.get<OrganizationNotificationChannelsResponse>(this._baseUrl);
  }

  limits(): Observable<OrganizationNotificationChannelLimits> {
    return this._httpClient.get<OrganizationNotificationChannelLimits>(`${this._baseUrl}/limits`);
  }

  create(payload: StoreNotificationChannelPayload): Observable<OrganizationNotificationChannel> {
    return this._httpClient.post<OrganizationNotificationChannel>(this._baseUrl, payload);
  }

  update(id: string, payload: UpdateNotificationChannelPayload): Observable<OrganizationNotificationChannel> {
    return this._httpClient.put<OrganizationNotificationChannel>(`${this._baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this._httpClient.delete<void>(`${this._baseUrl}/${id}`);
  }

  resendVerification(id: string): Observable<OrganizationNotificationChannel> {
    return this._httpClient.post<OrganizationNotificationChannel>(`${this._baseUrl}/${id}/resend-verification`, {});
  }
}
