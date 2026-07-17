import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProcessTimelineEvent } from '@app/core/models/process/process-timeline.model';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { presentTimelineEvent } from './process-timeline.presentation';
import { ProcessTimelineSemaphoreChangeComponent } from './process-timeline-semaphore-change.component';

@Component({
  selector: 'app-process-timeline-item',
  standalone: true,
  imports: [TranslocoPipe, ProcessTimelineSemaphoreChangeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="timeline-item" [attr.data-event-type]="event().event_type">
      <div class="timeline-item__rail" aria-hidden="true">
        <span class="timeline-item__marker" [attr.data-tone]="presentation().tone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              [attr.d]="presentation().iconPath"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
        </span>
      </div>

      <div class="timeline-item__content">
        <div class="timeline-item__heading">
          <div class="min-w-0">
            <h4>{{ presentation().title }}</h4>
            <p class="timeline-item__description">{{ presentation().description }}</p>
          </div>
          <time
            class="timeline-item__time"
            [attr.datetime]="event().occurred_at"
            [attr.title]="
              showTechnicalMetadata() && event().occurred_at_is_estimated
                ? ('processDetail.timeline.historicalHelp' | transloco)
                : null
            "
          >
            {{ showTechnicalMetadata() && event().occurred_at_is_estimated ? '≈ ' : '' }}{{ formattedTime() }}
          </time>
        </div>

        @if (presentation().semaphore; as semaphore) {
          <app-process-timeline-semaphore-change
            [from]="semaphore.from"
            [to]="semaphore.to"
            [fromLabel]="semaphore.fromLabel"
            [toLabel]="semaphore.toLabel"
          />
        }

        @if (presentation().details.length > 0) {
          <dl class="timeline-item__details">
            @for (detail of presentation().details; track detail.label) {
              <div>
                <dt>{{ detail.label }}</dt>
                <dd>{{ detail.value }}</dd>
              </div>
            }
          </dl>
        }

        <div class="timeline-item__meta">
          @if (presentation().actor; as actor) {
            <span>{{ actor }}</span>
          }
          @if (presentation().source && presentation().source !== presentation().actor) {
            <span>{{ presentation().source }}</span>
          }
          @if (showTechnicalMetadata() && event().is_backfilled) {
            <span
              class="timeline-item__badge"
              [attr.title]="'processDetail.timeline.historicalHelp' | transloco"
            >
              {{ 'processDetail.timeline.backfilled' | transloco }}
            </span>
          }
          @if (showTechnicalMetadata() && event().occurred_at_is_estimated) {
            <span
              class="timeline-item__badge"
              [attr.title]="'processDetail.timeline.historicalHelp' | transloco"
            >
              {{ 'processDetail.timeline.estimated' | transloco }}
            </span>
          }
        </div>
      </div>
    </article>
  `,
  styleUrl: './process-timeline-item.component.scss',
})
export class ProcessTimelineItemComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly activeLanguage = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang() || 'es',
  });

  readonly event = input.required<ProcessTimelineEvent>();
  readonly presentation = computed(() =>
    presentTimelineEvent(
      this.event(),
      (key, params) => this.transloco.translate(key, params),
      this.activeLanguage()
    )
  );
  readonly showTechnicalMetadata = computed(
    () => this.event().display?.show_technical_metadata === true
  );
  readonly formattedTime = computed(() => this.event().display?.time ?? '–');
}
