import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { Keyword, KeywordPagination } from '@app/core/models/keyword/keyword.model';

export interface KeywordStatus {
    value: string;
    label: string;
}

@Injectable({
    providedIn: 'root'
})
export class KeywordService {
    private _httpClient = inject(HttpClient);
    private readonly _baseUrl = `${environment.apiBaseUrl}/keywords`;

    /**
     * Get paginated keywords with optional filters
     * @param page Page number
     * @param perPage Items per page
     * @param filters Optional filter parameters (name, keyword, status)
     */
    getKeywords(page: number = 1, perPage: number = 10, filters: any = {}): Observable<KeywordPagination> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('per_page', perPage.toString());

        // Add additional filters if they exist
        if (filters.name) params = params.set('name', filters.name);
        if (filters.keyword) params = params.set('keyword', filters.keyword);
        if (filters.status) params = params.set('status', filters.status);

        return this._httpClient.get<KeywordPagination>(this._baseUrl, { params });
    }

    /**
     * Get available keyword statuses
     */
    getStatuses(): Observable<KeywordStatus[]> {
        return this._httpClient.get<KeywordStatus[]>(`${this._baseUrl}/statuses`);
    }

    /**
     * Create a new keyword
     * @param keyword Keyword data
     */
    createKeyword(keyword: Partial<Keyword>): Observable<Keyword> {
        return this._httpClient.post<Keyword>(this._baseUrl, keyword);
    }

    /**
     * Update an existing keyword
     * @param id Keyword ID
     * @param keyword Updated data
     */
    updateKeyword(id: string, keyword: Partial<Keyword>): Observable<Keyword> {
        return this._httpClient.put<Keyword>(`${this._baseUrl}/${id}`, keyword);
    }

    /**
     * Delete a keyword
     * @param id Keyword ID
     */
    deleteKeyword(id: string): Observable<any> {
        return this._httpClient.delete(`${this._baseUrl}/${id}`);
    }

    /**
     * Update keyword status
     * @param id Keyword ID
     * @param status New status
     */
    updateStatus(id: string, status: 'active' | 'inactive'): Observable<Keyword> {
        return this._httpClient.patch<Keyword>(`${this._baseUrl}/${id}/status`, { status });
    }
}
