import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { ProcessImportHistoryResponse } from '@app/core/models/process/process-import-history.model';

@Injectable({
  providedIn: 'root',
})
export class ProcessImportHistoryService {
  private _http = inject(HttpClient);

  getHistory(page: number = 1, perPage: number = 15): Observable<ProcessImportHistoryResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    const url = `${environment.apiBaseUrl}/processes/import-history`;
    return this._http.get<ProcessImportHistoryResponse>(url, { params });
  }
}
