import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-process-timeline-semaphore-change',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="semaphore-transition"
      [attr.aria-label]="
        ('processDetail.timeline.semaphore.transition' | transloco) +
        ': ' +
        levelLabel(from(), fromLabel()) +
        ' → ' +
        levelLabel(to(), toLabel())
      "
    >
      <span class="semaphore-level" [attr.data-level]="from() ?? 'none'">
        <span class="semaphore-level__dot" aria-hidden="true"></span>
        {{ levelLabel(from(), fromLabel()) }}
      </span>
      <span class="semaphore-transition__arrow" aria-hidden="true">→</span>
      <span class="semaphore-level" [attr.data-level]="to() ?? 'none'">
        <span class="semaphore-level__dot" aria-hidden="true"></span>
        {{ levelLabel(to(), toLabel()) }}
      </span>
    </div>
  `,
  styles: `
    .semaphore-transition {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.65rem;
    }
    .semaphore-level {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border-radius: 9999px;
      border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
      padding: 0.25rem 0.55rem;
      color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
      font-size: 0.6875rem;
      font-weight: 700;
    }
    .semaphore-level__dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 9999px;
      background: currentColor;
    }
    [data-level='red'] { color: var(--color-error); }
    [data-level='yellow'] { color: #a16207; }
    [data-level='green'] { color: var(--color-success); }
    [data-level='none'] { color: color-mix(in srgb, var(--color-base-content) 45%, transparent); }
    .semaphore-transition__arrow {
      color: color-mix(in srgb, var(--color-base-content) 35%, transparent);
      font-weight: 700;
    }
  `,
})
export class ProcessTimelineSemaphoreChangeComponent {
  private readonly transloco = inject(TranslocoService);

  readonly from = input.required<string | null>();
  readonly to = input.required<string | null>();
  readonly fromLabel = input<string | null>(null);
  readonly toLabel = input<string | null>(null);

  levelLabel(level: string | null, displayLabel: string | null): string {
    if (displayLabel) return displayLabel;
    const normalized = ['red', 'yellow', 'green'].includes(level ?? '') ? level : 'none';
    return this.transloco.translate(`processDetail.timeline.semaphore.${normalized}`);
  }
}
