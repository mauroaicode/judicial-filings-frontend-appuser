import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { User } from '@app/core/models/auth/auth.model';

export interface SessionLockUpdatePayload {
  session_lock_enabled: boolean;
  session_lock_timeout: number;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private _httpClient = inject(HttpClient);
  private _baseUrl = `${environment.apiBaseUrl}/config`;

  /**
   * Update session lock settings
   */
  updateSessionLock(data: SessionLockUpdatePayload): Observable<User> {
    return this._httpClient.put<User>(`${this._baseUrl}/session-lock`, data);
  }
}
