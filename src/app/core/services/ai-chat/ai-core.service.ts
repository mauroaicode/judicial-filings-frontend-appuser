import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { AuthService } from '@app/core/auth/auth.service';

export interface AiStatusResponse {
  is_ai_enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AiCoreService {
  private _http = inject(HttpClient);
  private _auth = inject(AuthService);
  private _baseUrl = environment.apiBaseUrl;

  // Signal reactivo para el estado de la IA
  private _isAiEnabled = signal<boolean>(false);
  
  // Caché para evitar re-peticiones si ya se consultó esa org
  private _checkedOrgs = new Set<string>();

  // Exposición pública del estado
  public isAiEnabled = this._isAiEnabled.asReadonly();

  /**
   * Verifica el estado de la IA para una organización específica.
   * Si no se proporciona organizationId, intenta obtenerlo del AuthService.
   */
  checkAiStatus(organizationId?: string): Observable<AiStatusResponse> {
    const orgId = organizationId || this._auth.organizationId;
    
    if (!orgId) return of({ is_ai_enabled: false });

    // Si ya chequeamos esta org con éxito, no repetimos la llamada HTTP
    if (this._checkedOrgs.has(orgId)) {
      return of({ is_ai_enabled: this._isAiEnabled() });
    }

    return this._http.get<AiStatusResponse>(`${this._baseUrl}/organizations/${orgId}/ai-status`)
      .pipe(
        tap(res => {
          this._isAiEnabled.set(res.is_ai_enabled);
          this._checkedOrgs.add(orgId);
        })
      );
  }
}
