import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { Task, TaskPagination, TaskCreateRequest, ProcessSummary } from '@app/core/models/tasks/task.model';

@Injectable({
    providedIn: 'root'
})
export class TaskService {
    private _httpClient = inject(HttpClient);
    private readonly _baseUrl = `${environment.apiBaseUrl}/tasks`;

    /**
     * Get paginated tasks
     * @param page Page number
     * @param perPage Items per page
     */
    getTasks(page: number = 1, perPage: number = 10): Observable<TaskPagination> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('per_page', perPage.toString());

        return this._httpClient.get<TaskPagination>(this._baseUrl, { params });
    }

    /**
     * Create a new task
     * @param task Task data
     */
    createTask(task: TaskCreateRequest): Observable<Task> {
        return this._httpClient.post<Task>(this._baseUrl, task);
    }

    /**
     * Update an existing task
     * @param id Task ID
     * @param task Updated data
     */
    updateTask(id: string, task: TaskCreateRequest): Observable<Task> {
        return this._httpClient.put<Task>(`${this._baseUrl}/${id}`, task);
    }

    /**
     * Delete a task
     * @param id Task ID
     */
    deleteTask(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this._baseUrl}/${id}`);
    }

    /**
     * Get active processes for an organization
     * @param organizationId Organization ID
     * @param processNumber Optional process number filter
     * @param court Optional court filter
     */
    getOrganizationProcesses(organizationId: string, processNumber?: string, court?: string): Observable<ProcessSummary[]> {
        let params = new HttpParams();
        if (processNumber) params = params.set('process_number', processNumber);
        if (court) params = params.set('court', court);

        return this._httpClient.get<ProcessSummary[]>(`${environment.apiBaseUrl}/organizations/${organizationId}/processes`, { params });
    }
}
