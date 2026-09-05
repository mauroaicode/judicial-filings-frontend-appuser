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
      <span class="semaphore-level" [attr.data-level]="levelKey(from())">
        <span class="semaphore-level__dot" aria-hidden="true"></span>
        {{ levelLabel(from(), fromLabel()) }}
      </span>
      <span class="semaphore-transition__arrow" aria-hidden="true">→</span>
      <span class="semaphore-level" [attr.data-level]="levelKey(to())">
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
      gap: 0.4rem;
      border-radius: 9999px;
      border: 1px solid color-mix(in srgb, var(--color-base-content) 12%, transparent);
      padding: 0.25rem 0.55rem;
      color: color-mix(in srgb, var(--color-base-content) 72%, transparent);
      font-size: 0.6875rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--color-base-content) 4%, transparent);
    }
    .semaphore-level__dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 9999px;
      flex-shrink: 0;
      background-color: #94a3b8;
      box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.25);
    }
    .semaphore-level[data-level='red'] {
      color: #b91c1c;
      border-color: color-mix(in srgb, #ef4444 35%, transparent);
      background: color-mix(in srgb, #ef4444 8%, transparent);
    }
    .semaphore-level[data-level='red'] .semaphore-level__dot {
      background-color: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
    }
    .semaphore-level[data-level='yellow'] {
      color: #a16207;
      border-color: color-mix(in srgb, #f59e0b 35%, transparent);
      background: color-mix(in srgb, #f59e0b 8%, transparent);
    }
    .semaphore-level[data-level='yellow'] .semaphore-level__dot {
      background-color: #f59e0b;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
    }
    .semaphore-level[data-level='green'] {
      color: #15803d;
      border-color: color-mix(in srgb, #22c55e 35%, transparent);
      background: color-mix(in srgb, #22c55e 8%, transparent);
    }
    .semaphore-level[data-level='green'] .semaphore-level__dot {
      background-color: #22c55e;
      box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
    }
    .semaphore-level[data-level='none'] {
      color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    }
    .semaphore-transition__arrow {
      color: color-mix(in srgb, var(--color-base-content) 35%, transparent);
      font-weight: 700;
    }
    :host-context([data-theme='dark']) .semaphore-level[data-level='red'] {
      color: #fca5a5;
    }
    :host-context([data-theme='dark']) .semaphore-level[data-level='yellow'] {
      color: #fcd34d;
    }
    :host-context([data-theme='dark']) .semaphore-level[data-level='green'] {
      color: #86efac;
    }
    :host-context([data-theme='dark']) .semaphore-level[data-level='none'] {
      color: #c4b8d9;
    }
    :host-context([data-theme='dark']) .semaphore-level[data-level='none'] .semaphore-level__dot {
      background-color: #94a3b8;
      box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.35);
    }
  `,
})
export class ProcessTimelineSemaphoreChangeComponent {
  private readonly transloco = inject(TranslocoService);

  readonly from = input.required<string | null>();
  readonly to = input.required<string | null>();
  readonly fromLabel = input<string | null>(null);
  readonly toLabel = input<string | null>(null);

  levelKey(level: string | null): string {
    const normalized = (level ?? '').trim().toLowerCase();
    if (['red', 'rojo', 'r', 'critical'].includes(normalized)) return 'red';
    if (['yellow', 'amarillo', 'y', 'amber', 'warning'].includes(normalized)) return 'yellow';
    if (['green', 'verde', 'g', 'ok', 'success'].includes(normalized)) return 'green';
    return 'none';
  }

  levelLabel(level: string | null, displayLabel: string | null): string {
    if (displayLabel) return displayLabel;
    const normalized = this.levelKey(level);
    return this.transloco.translate(`processDetail.timeline.semaphore.${normalized}`);
  }
}
