import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@app/core/config/environment.config';
import {
  ProcessFilter,
  ProcessResponse,
  ProcessResponseMeta,
  CreateProcessResponse,
  ProcessDetailResponse,
  ActionFilter,
  ActionResponse,
  AlertKeywordsResponse,
  AlertKeywordStatsResponse,
  ProcessDetailInstance,
} from '@app/core/models/process/process.model';

@Injectable({
  providedIn: 'root',
})
export class ProcessService {
  private _http = inject(HttpClient);

  /**
   * Get processes with filters and pagination
   *
   * @param filters - Filter options
   * @returns Observable with processes response
   */
  getProcesses(filters: ProcessFilter = {}): Observable<ProcessResponse> {
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
    if (filters.court) {
      params = params.set('court', filters.court);
    }
    if (filters.process_class) {
      params = params.set('process_class', filters.process_class);
    }
    if (filters.plaintiff) {
      params = params.set('plaintiff', filters.plaintiff);
    }
    if (filters.defendant) {
      params = params.set('defendant', filters.defendant);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.has_multiple_instances !== undefined && filters.has_multiple_instances !== null) {
      params = params.set('has_multiple_instances', filters.has_multiple_instances.toString());
    }
    if (filters.process_date_from) {
      params = params.set('process_date_from', filters.process_date_from);
    }
    if (filters.process_date_to) {
      params = params.set('process_date_to', filters.process_date_to);
    }
    if (filters.created_at_from) {
      params = params.set('created_at_from', filters.created_at_from);
    }
    if (filters.created_at_to) {
      params = params.set('created_at_to', filters.created_at_to);
    }
    if (filters.last_api_update_from) {
      params = params.set('last_api_update_from', filters.last_api_update_from);
    }
    if (filters.last_api_update_to) {
      params = params.set('last_api_update_to', filters.last_api_update_to);
    }
    if (filters.lawyer_role) {
      params = params.set('lawyer_role', filters.lawyer_role);
    }
    if (filters.severity_color) {
      params = params.set('severity_color', filters.severity_color);
    }

    const url = `${environment.apiBaseUrl}/processes`;

    return this._http.get<ProcessResponse>(url, { params }).pipe(
      map((response) => {
        const baseNumber = response.from ?? (response.current_page - 1) * response.per_page + 1;
        const mappedProcesses = response.data.map((process, index) => {
          const displayNumber = baseNumber + index;
          return {
            ...process,
            display_number: displayNumber,
          };
        });

        return {
          ...response,
          data: mappedProcesses,
        };
      })
    );
  }

  /**
   * Create a new process
   *
   * @param processNumber - Process number (23 digits)
   * @param lawyerRole - Lawyer role (plaintiff or defendant)
   * @returns Observable with created process response
   */
  createProcess(processNumber: string, lawyerRole: string): Observable<CreateProcessResponse> {
    const url = `${environment.apiBaseUrl}/processes`;
    return this._http.post<CreateProcessResponse>(url, {
      process_number: processNumber,
      lawyer_role: lawyerRole,
    });
  }

  /**
   * Get process detail by ID
   *
   * @param id - Process ID
   * @returns Observable with process detail response
   */
  getProcessDetail(id: string): Observable<ProcessDetailResponse> {
    const url = `${environment.apiBaseUrl}/processes/${id}`;
    return this._http.get<ProcessDetailResponse>(url);
  }

  /**
   * Get all instances for a process number/group
   *
   * @param id - Any process ID from the instances group
   * @returns Observable with instances summary list
   */
  getProcessInstances(id: string): Observable<ProcessDetailInstance[]> {
    const url = `${environment.apiBaseUrl}/processes/${id}/instances`;
    return this._http.get<ProcessDetailInstance[]>(url);
  }

  /**
   * Get alert keywords for a process (for filtering actions by keyword)
   *
   * @param processId - Process ID
   * @returns Observable with list of alert keywords
   */
  getAlertKeywords(processId: string): Observable<AlertKeywordsResponse> {
    const url = `${environment.apiBaseUrl}/processes/${processId}/alert-keywords`;
    return this._http.get<AlertKeywordsResponse>(url);
  }

  /**
   * Get alert keyword stats for a process (count per keyword)
   *
   * @param processId - Process ID
   * @returns Observable with list of keyword stats (name, slug, count)
   */
  getAlertKeywordStats(processId: string): Observable<AlertKeywordStatsResponse> {
    const url = `${environment.apiBaseUrl}/processes/${processId}/alert-keyword-stats`;
    return this._http.get<AlertKeywordStatsResponse>(url);
  }

  /**
   * Get process actions with filters and pagination
   *
   * @param id - Process ID
   * @param filters - Filter options
   * @returns Observable with actions response
   */
  getProcessActions(id: string, filters: ActionFilter = {}): Observable<ActionResponse> {
    let params = new HttpParams();

    if (filters.page) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.per_page) {
      params = params.set('per_page', filters.per_page.toString());
    }

    if (filters.action_date_from) {
      params = params.set('action_date_from', filters.action_date_from);
    }
    if (filters.action_date_to) {
      params = params.set('action_date_to', filters.action_date_to);
    }
    if (filters.registration_date_from) {
      params = params.set('registration_date_from', filters.registration_date_from);
    }
    if (filters.registration_date_to) {
      params = params.set('registration_date_to', filters.registration_date_to);
    }
    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.alert_slug) {
      params = params.set('alert_slug', filters.alert_slug);
    }

    const url = `${environment.apiBaseUrl}/processes/${id}/actions`;
    return this._http.get<ActionResponse>(url, { params });
  }

  /**
   * Update process status (activate/deactivate)
   *
   * @param id - Process ID
   * @param isActive - true to activate, false to deactivate
   * @returns Observable with message response
   */
  updateProcessStatus(id: string, isActive: boolean): Observable<{ message: string }> {
    const url = `${environment.apiBaseUrl}/processes/${id}/status`;
    return this._http.patch<{ message: string }>(url, { is_active: isActive });
  }

  /**
   * Get available roles for processes
   * 
   * @returns Observable with list of roles (value, label)
   */
  getProcessRoles(): Observable<{ value: string; label: string }[]> {
    const url = `${environment.apiBaseUrl}/config/processes/roles`;
    return this._http.get<{ value: string; label: string }[]>(url);
  }

  /**
   * Update lawyer role for a process
   * 
   * @param id - Process ID
   * @param role - Role value (e.g. 'plaintiff', 'defendant')
   * @returns Observable with message response
   */
  updateProcessRole(id: string, role: string): Observable<{ message: string }> {
    const url = `${environment.apiBaseUrl}/processes/${id}/config/roles`;
    return this._http.post<{ message: string }>(url, { lawyer_role: role });
  }

  /**
   * Update lawyer role for multiple processes in bulk
   * 
   * @param processIds - Array of process IDs
   * @param role - Role value (e.g. 'plaintiff', 'defendant')
   * @returns Observable with bulk update response (message, counts, alerts)
   */
  updateBulkProcessRoles(processIds: string[], role: string): Observable<import('@app/core/models/process/process.model').BulkRoleUpdateResponse> {
    const url = `${environment.apiBaseUrl}/processes/bulk-config/roles`;
    return this._http.patch<import('@app/core/models/process/process.model').BulkRoleUpdateResponse>(url, { 
      process_ids: processIds,
      lawyer_role: role 
    });
  }
}
