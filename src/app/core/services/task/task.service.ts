import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import {
    Task,
    TaskPagination,
    TaskCreateRequest,
    TaskUpdateRequest,
    TaskStatusUpdateRequest,
    ProcessSummary,
    TaskStatus,
    TaskStatusOption,
} from '@app/core/models/tasks/task.model';

@Injectable({
    providedIn: 'root'
})
export class TaskService {
    private _httpClient = inject(HttpClient);
    private readonly _baseUrl = `${environment.apiBaseUrl}/tasks`;

    getTasks(page: number = 1, perPage: number = 20, status?: TaskStatus): Observable<TaskPagination> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('per_page', perPage.toString());

        if (status) {
            params = params.set('status', status);
        }

        return this._httpClient.get<TaskPagination>(this._baseUrl, { params });
    }

    getTask(id: string): Observable<Task> {
        return this._httpClient.get<Task>(`${this._baseUrl}/${id}`);
    }

    getStatuses(): Observable<TaskStatusOption[]> {
        return this._httpClient.get<TaskStatusOption[]>(`${this._baseUrl}/statuses`);
    }

    createTask(task: TaskCreateRequest): Observable<Task> {
        return this._httpClient.post<Task>(this._baseUrl, task);
    }

    updateTask(id: string, task: TaskUpdateRequest): Observable<Task> {
        return this._httpClient.put<Task>(`${this._baseUrl}/${id}`, task);
    }

    updateTaskStatus(id: string, payload: TaskStatusUpdateRequest): Observable<Task> {
        return this._httpClient.patch<Task>(`${this._baseUrl}/${id}/status`, payload);
    }

    completeTask(id: string): Observable<Task> {
        return this._httpClient.put<Task>(`${this._baseUrl}/${id}/complete`, {});
    }

    deleteTask(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this._baseUrl}/${id}`);
    }

    getTrashTasks(page: number = 1, perPage: number = 20): Observable<TaskPagination> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('per_page', perPage.toString());

        return this._httpClient.get<TaskPagination>(`${this._baseUrl}/trash`, { params });
    }

    restoreTask(id: string): Observable<Task> {
        return this._httpClient.post<Task>(`${this._baseUrl}/${id}/restore`, {});
    }

    forceDeleteTask(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this._baseUrl}/${id}/force`);
    }

    getOrganizationProcesses(organizationId: string, processNumber?: string, court?: string): Observable<ProcessSummary[]> {
        let params = new HttpParams();
        if (processNumber) params = params.set('process_number', processNumber);
        if (court) params = params.set('court', court);

        return this._httpClient.get<ProcessSummary[]>(`${environment.apiBaseUrl}/organizations/${organizationId}/processes`, { params });
    }
}
