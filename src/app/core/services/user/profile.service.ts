import {HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from '@app/core/config/environment.config';
import {ProfileUpdateRequest, User} from '@app/core/models/auth/auth.model';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private _httpClient = inject(HttpClient);
  private _baseUrl = `${environment.apiBaseUrl}/profile`;

  /**
   * Get current user profile
   */
  getProfile(): Observable<User> {
    return this._httpClient.get<User>(this._baseUrl);
  }

  /**
   * Update current user profile
   * @param data Profile update data
   */
  updateProfile(data: ProfileUpdateRequest): Observable<User> {
    return this._httpClient.put<User>(this._baseUrl, data);
  }
}
