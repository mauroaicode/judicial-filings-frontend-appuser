import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  ProcessTimelineEvent,
  ProcessTimelineResponse,
} from '@app/core/models/process/process-timeline.model';
import { ProcessTimelineApiService } from '@app/core/services/process/process-timeline-api.service';
import { Subject } from 'rxjs';
import { ProcessTimelineStore } from './process-timeline.store';

describe('ProcessTimelineStore', () => {
  let store: ProcessTimelineStore;
  let api: jasmine.SpyObj<ProcessTimelineApiService>;
  let requests: Subject<ProcessTimelineResponse>[];

  beforeEach(() => {
    requests = [];
    api = jasmine.createSpyObj<ProcessTimelineApiService>('ProcessTimelineApiService', [
      'getTimeline',
    ]);
    api.getTimeline.and.callFake(() => {
      const request = new Subject<ProcessTimelineResponse>();
      requests.push(request);
      return request;
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ProcessTimelineStore,
        { provide: ProcessTimelineApiService, useValue: api },
      ],
    });
    store = TestBed.inject(ProcessTimelineStore);
  });

  it('loads page one initially', () => {
    store.load('process-a');
    expect(api.getTimeline).toHaveBeenCalledWith('process-a', 1, 20);
    expect(store.loadingInitial()).toBeTrue();

    requests[0].next(response(1, 2, [event('new', '2026-07-16T12:00:00Z')]));
    expect(store.events().map((item) => item.id)).toEqual(['new']);
    expect(store.loadingInitial()).toBeFalse();
    expect(store.hasMore()).toBeTrue();
  });

  it('appends the next page, deduplicates IDs, and keeps newest first', () => {
    store.load('process-a');
    requests[0].next(response(1, 2, [event('new', '2026-07-16T12:00:00Z')]));

    store.loadMore();
    expect(api.getTimeline).toHaveBeenCalledWith('process-a', 2, 20);
    expect(store.loadingMore()).toBeTrue();
    requests[1].next(
      response(2, 2, [
        event('new', '2026-07-16T12:00:00Z'),
        event('old', '2026-07-15T12:00:00Z'),
      ])
    );

    expect(store.events().map((item) => item.id)).toEqual(['new', 'old']);
    expect(store.hasMore()).toBeFalse();
    expect(store.loadingMore()).toBeFalse();
  });

  it('stops pagination when next_page_url is null', () => {
    store.load('process-a');
    requests[0].next(response(1, 4, [event('only')], null));
    expect(store.currentPage()).toBe(1);
    expect(store.lastPage()).toBe(1);
    expect(store.hasMore()).toBeFalse();

    store.loadMore();
    expect(api.getTimeline).toHaveBeenCalledTimes(1);
  });

  it('exposes an error and retries the initial request', () => {
    store.load('process-a');
    requests[0].error(new Error('network'));
    expect(store.error()).toBe('processDetail.timeline.error');
    expect(store.loadingInitial()).toBeFalse();

    store.retry();
    expect(api.getTimeline).toHaveBeenCalledTimes(2);
    expect(store.events()).toEqual([]);
  });

  it('clears events and cancels the old request when processId changes', () => {
    store.load('process-a');
    requests[0].next(response(1, 2, [event('process-a-event')]));
    expect(store.events().length).toBe(1);

    store.load('process-b');
    expect(store.events()).toEqual([]);
    expect(api.getTimeline).toHaveBeenCalledWith('process-b', 1, 20);
    expect(requests[0].observed).toBeFalse();
  });

  it('prevents simultaneous load-more requests', () => {
    store.load('process-a');
    requests[0].next(response(1, 3, [event('first')]));
    store.loadMore();
    store.loadMore();
    expect(api.getTimeline).toHaveBeenCalledTimes(2);
  });

  function response(
    currentPage: number,
    lastPage: number,
    data: ProcessTimelineEvent[],
    nextPageUrl: string | null = '/next'
  ): ProcessTimelineResponse {
    return {
      current_page: currentPage,
      data,
      last_page: lastPage,
      next_page_url: currentPage >= lastPage ? null : nextPageUrl,
      per_page: 20,
      total: data.length,
    };
  }

  function event(id: string, occurredAt = '2026-07-16T10:00:00Z'): ProcessTimelineEvent {
    return {
      id,
      event_type: 'tracking_activated',
      source: 'system',
      process_id: 'process-a',
      process_number: '76001333301820180024701',
      organization_id: null,
      subject_type: null,
      subject_id: null,
      actor_type: 'system',
      actor_id: null,
      payload: {},
      occurred_at: occurredAt,
      recorded_at: occurredAt,
      is_backfilled: false,
      occurred_at_is_estimated: false,
    };
  }
});
