import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-process-timeline-speaker-change',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="speaker-transition"
      [attr.aria-label]="
        ('processDetail.timeline.speaker.transition' | transloco) +
        ': ' +
        from() +
        ' → ' +
        to()
      "
    >
      <div class="speaker-party">
        <span class="speaker-party__label">{{ 'processDetail.timeline.speaker.from' | transloco }}</span>
        <span class="speaker-party__name">{{ from() }}</span>
      </div>
      <span class="speaker-transition__arrow" aria-hidden="true">→</span>
      <div class="speaker-party">
        <span class="speaker-party__label">{{ 'processDetail.timeline.speaker.to' | transloco }}</span>
        <span class="speaker-party__name">{{ to() }}</span>
      </div>
    </div>
  `,
  styles: `
    .speaker-transition {
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 0.5rem;
      margin-top: 0.65rem;
    }
    .speaker-party {
      display: flex;
      min-width: 0;
      max-width: 100%;
      flex-direction: column;
      gap: 0.2rem;
      border-radius: 0.85rem;
      border: 1px solid color-mix(in srgb, var(--color-base-content) 12%, transparent);
      padding: 0.4rem 0.7rem;
      background: color-mix(in srgb, var(--color-base-content) 4%, transparent);
    }
    .speaker-party__label {
      color: color-mix(in srgb, var(--color-base-content) 45%, transparent);
      font-size: 0.625rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .speaker-party__name {
      max-width: 18rem;
      color: color-mix(in srgb, var(--color-base-content) 82%, transparent);
      font-size: 0.8125rem;
      font-weight: 700;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .speaker-transition__arrow {
      align-self: center;
      color: color-mix(in srgb, var(--color-base-content) 35%, transparent);
      font-weight: 700;
    }
    :host-context([data-theme='dark']) .speaker-party {
      border-color: color-mix(in srgb, var(--color-base-content) 18%, transparent);
      background: color-mix(in srgb, var(--color-base-200) 55%, var(--color-base-100));
    }
    :host-context([data-theme='dark']) .speaker-party__label {
      color: color-mix(in srgb, var(--color-base-content) 68%, transparent);
    }
    :host-context([data-theme='dark']) .speaker-party__name {
      color: #f8f5ff;
    }
    :host-context([data-theme='dark']) .speaker-transition__arrow {
      color: color-mix(in srgb, var(--color-base-content) 62%, transparent);
    }
  `,
})
export class ProcessTimelineSpeakerChangeComponent {
  readonly from = input.required<string>();
  readonly to = input.required<string>();
}
