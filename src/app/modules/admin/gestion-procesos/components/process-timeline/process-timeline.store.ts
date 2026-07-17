import { computed, inject, Injectable, signal } from '@angular/core';
import { ProcessTimelineEvent } from '@app/core/models/process/process-timeline.model';
import { ProcessTimelineApiService } from '@app/core/services/process/process-timeline-api.service';
import { Subscription } from 'rxjs';

const TIMELINE_PAGE_SIZE = 20;

@Injectable()
export class ProcessTimelineStore {
  private readonly api = inject(ProcessTimelineApiService);
  private requestSubscription: Subscription | null = null;
  private activeProcessId: string | null = null;

  readonly events = signal<ProcessTimelineEvent[]>([]);
  readonly currentPage = signal(0);
  readonly lastPage = signal(0);
  readonly loadingInitial = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasMore = computed(
    () => this.currentPage() < this.lastPage() && this.currentPage() > 0
  );

  load(processId: string): void {
    if (!processId || (processId === this.activeProcessId && this.loadingInitial())) return;

    this.cancelRequest();
    this.activeProcessId = processId;
    this.resetState();
    this.loadingInitial.set(true);
    this.requestPage(processId, 1, false);
  }

  loadMore(): void {
    if (
      !this.activeProcessId ||
      this.loadingInitial() ||
      this.loadingMore() ||
      !this.hasMore()
    ) {
      return;
    }

    this.loadingMore.set(true);
    this.requestPage(this.activeProcessId, this.currentPage() + 1, true);
  }

  retry(): void {
    if (!this.activeProcessId) return;
    if (this.events().length === 0) {
      this.load(this.activeProcessId);
      return;
    }

    this.error.set(null);
    this.loadingMore.set(true);
    this.requestPage(this.activeProcessId, this.currentPage() + 1, true);
  }

  destroy(): void {
    this.cancelRequest();
  }

  private requestPage(processId: string, page: number, append: boolean): void {
    this.requestSubscription = this.api
      .getTimeline(processId, page, TIMELINE_PAGE_SIZE)
      .subscribe({
        next: (response) => {
          if (processId !== this.activeProcessId) return;

          const combined = append ? [...this.events(), ...response.data] : response.data;
          const uniqueEvents = Array.from(
            new Map(combined.map((event) => [event.id, event])).values()
          ).sort(
            (left, right) =>
              this.timestamp(right.occurred_at) - this.timestamp(left.occurred_at)
          );

          this.events.set(uniqueEvents);
          this.currentPage.set(response.current_page);
          this.lastPage.set(
            response.next_page_url === null
              ? response.current_page
              : Math.max(response.current_page, response.last_page)
          );
          this.error.set(null);
          this.finishLoading();
        },
        error: () => {
          if (processId !== this.activeProcessId) return;
          this.error.set('processDetail.timeline.error');
          this.finishLoading();
        },
      });
  }

  private resetState(): void {
    this.events.set([]);
    this.currentPage.set(0);
    this.lastPage.set(0);
    this.error.set(null);
    this.loadingInitial.set(false);
    this.loadingMore.set(false);
  }

  private finishLoading(): void {
    this.loadingInitial.set(false);
    this.loadingMore.set(false);
  }

  private cancelRequest(): void {
    this.requestSubscription?.unsubscribe();
    this.requestSubscription = null;
  }

  private timestamp(value: string): number {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
}
