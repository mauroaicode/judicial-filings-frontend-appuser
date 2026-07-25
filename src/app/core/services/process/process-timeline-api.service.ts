import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ProcessTimelineEvent,
  ProcessTimelineResponse,
} from '@app/core/models/process/process-timeline.model';
import { environment } from '@app/core/config/environment.config';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProcessTimelineApiService {
  private readonly http = inject(HttpClient);

  getTimeline(processId: string, page = 1, perPage = 20): Observable<ProcessTimelineResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));
    const headers = new HttpHeaders({ Accept: 'application/json' });

    return this.http
      .get<unknown>(`${environment.apiBaseUrl}/processes/${processId}/timeline`, {
        params,
        headers,
      })
      .pipe(map((response) => this.parseResponse(response)));
  }

  private parseResponse(value: unknown): ProcessTimelineResponse {
    if (!this.isRecord(value) || !Array.isArray(value['data'])) {
      throw new Error('Invalid process timeline response');
    }

    const currentPage = this.readNumber(value, 'current_page');
    const lastPage = this.readNumber(value, 'last_page');
    const perPage = this.readNumber(value, 'per_page');
    const total = this.readNumber(value, 'total');
    const events = value['data'].filter((event): event is ProcessTimelineEvent =>
      this.isTimelineEvent(event)
    );

    return {
      current_page: currentPage,
      data: events,
      last_page: lastPage,
      next_page_url:
        typeof value['next_page_url'] === 'string' ? value['next_page_url'] : null,
      per_page: perPage,
      total,
    };
  }

  private isTimelineEvent(value: unknown): value is ProcessTimelineEvent {
    if (!this.isRecord(value)) return false;

    return (
      typeof value['id'] === 'string' &&
      typeof value['event_type'] === 'string' &&
      typeof value['source'] === 'string' &&
      typeof value['process_id'] === 'string' &&
      typeof value['process_number'] === 'string' &&
      this.isNullableString(value['organization_id']) &&
      this.isNullableString(value['subject_type']) &&
      this.isNullableString(value['subject_id']) &&
      this.isNullableString(value['actor_type']) &&
      this.isNullableString(value['actor_id']) &&
      this.isRecord(value['payload']) &&
      (value['display'] === undefined || this.isTimelineDisplay(value['display'])) &&
      typeof value['occurred_at'] === 'string' &&
      typeof value['recorded_at'] === 'string' &&
      typeof value['is_backfilled'] === 'boolean' &&
      typeof value['occurred_at_is_estimated'] === 'boolean'
    );
  }

  private isTimelineDisplay(value: unknown): boolean {
    if (!this.isRecord(value)) return false;

    return (
      typeof value['title'] === 'string' &&
      this.isNullableString(value['summary']) &&
      this.isNullableString(value['reason']) &&
      this.isNullableString(value['role']) &&
      this.isNullableString(value['from']) &&
      this.isNullableString(value['to']) &&
      this.isNullableString(value['source']) &&
      this.isNullableString(value['actor']) &&
      (value['dates'] === undefined || this.isTimelineDisplayDates(value['dates'])) &&
      typeof value['show_technical_metadata'] === 'boolean'
    );
  }

  private isTimelineDisplayDates(value: unknown): boolean {
    if (!Array.isArray(value)) return false;

    return value.every((item) => {
      if (!this.isRecord(item)) return false;
      return (
        typeof item['key'] === 'string' &&
        typeof item['attribute'] === 'string' &&
        typeof item['label'] === 'string' &&
        typeof item['value'] === 'string' &&
        typeof item['formatted'] === 'string'
      );
    });
  }

  private readNumber(value: Record<string, unknown>, key: string): number {
    const result = value[key];
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      throw new Error(`Invalid process timeline pagination field: ${key}`);
    }
    return result;
  }

  private isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
