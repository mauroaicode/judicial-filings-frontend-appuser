import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProcessTimelineGroup } from '@app/core/models/process/process-timeline.model';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ProcessTimelineItemComponent } from './process-timeline-item.component';
import { ProcessTimelineStore } from './process-timeline.store';

@Component({
  selector: 'app-process-timeline',
  standalone: true,
  imports: [TranslocoPipe, ProcessTimelineItemComponent],
  providers: [ProcessTimelineStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="process-timeline" [attr.aria-label]="'processDetail.timeline.title' | transloco">
      <header class="process-timeline__intro">
        <p>{{ 'processDetail.timeline.subtitle' | transloco }}</p>
      </header>

      @if (store.loadingInitial()) {
        <div class="timeline-skeleton" aria-busy="true" aria-live="polite">
          @for (item of [1, 2, 3]; track item) {
            <div class="timeline-skeleton__item">
              <span class="skeleton timeline-skeleton__marker"></span>
              <div>
                <span class="skeleton timeline-skeleton__title"></span>
                <span class="skeleton timeline-skeleton__line"></span>
              </div>
            </div>
          }
          <span class="sr-only">{{ 'common.loading' | transloco }}</span>
        </div>
      } @else if (store.error() && store.events().length === 0) {
        <div class="timeline-state" role="alert">
          <p>{{ store.error()! | transloco }}</p>
          <button type="button" class="btn btn-sm btn-outline btn-primary" (click)="store.retry()">
            {{ 'processDetail.timeline.retry' | transloco }}
          </button>
        </div>
      } @else if (store.events().length === 0) {
        <div class="timeline-state">
          <p>{{ 'processDetail.timeline.empty' | transloco }}</p>
        </div>
      } @else {
        <div class="timeline-groups">
          @for (group of groups(); track group.key) {
            <section class="timeline-group" [attr.aria-labelledby]="'timeline-date-' + group.key">
              <h3 [id]="'timeline-date-' + group.key">{{ group.label }}</h3>
              <div>
                @for (event of group.events; track event.id) {
                  <app-process-timeline-item [event]="event" />
                }
              </div>
            </section>
          }
        </div>

        @if (store.error()) {
          <div class="timeline-load-more-error" role="alert">
            <span>{{ store.error()! | transloco }}</span>
            <button type="button" class="btn btn-xs btn-ghost" (click)="store.retry()">
              {{ 'processDetail.timeline.retry' | transloco }}
            </button>
          </div>
        }

        @if (store.hasMore()) {
          <div class="process-timeline__footer">
            <button
              type="button"
              class="btn btn-sm btn-outline btn-primary"
              [disabled]="store.loadingMore()"
              (click)="store.loadMore()"
            >
              @if (store.loadingMore()) {
                <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
                {{ 'processDetail.timeline.loadingMore' | transloco }}
              } @else {
                {{ 'processDetail.timeline.loadMore' | transloco }}
              }
            </button>
          </div>
        } @else if (!store.error()) {
          <p class="process-timeline__end">{{ 'processDetail.timeline.end' | transloco }}</p>
        }
      }
    </section>
  `,
  styleUrl: './process-timeline.component.scss',
})
export class ProcessTimelineComponent {
  readonly store = inject(ProcessTimelineStore);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeLanguage = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang() || 'es',
  });

  readonly processId = input.required<string>();
  readonly groups = computed(() => this.groupEvents());

  constructor() {
    effect(() => this.store.load(this.processId()));
    this.destroyRef.onDestroy(() => this.store.destroy());
  }

  private groupEvents(): ProcessTimelineGroup[] {
    const groups = new Map<string, ProcessTimelineGroup>();
    const locale = this.activeLanguage();

    for (const event of this.store.events()) {
      const date = new Date(event.occurred_at);
      if (Number.isNaN(date.getTime())) continue;
      const key = this.localDateKey(date);
      const existing = groups.get(key);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.set(key, {
          key,
          date,
          label: this.dateLabel(date, locale),
          events: [event],
        });
      }
    }

    return Array.from(groups.values());
  }

  private dateLabel(date: Date, locale: string): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (this.localDateKey(date) === this.localDateKey(today)) {
      return this.transloco.translate('processDetail.timeline.today');
    }
    if (this.localDateKey(date) === this.localDateKey(yesterday)) {
      return this.transloco.translate('processDetail.timeline.yesterday');
    }

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private localDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
