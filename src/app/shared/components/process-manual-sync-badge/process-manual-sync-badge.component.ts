import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-process-manual-sync-badge',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <span
      class="process-manual-badge px-2 py-0.5 rounded-md text-[9px] uppercase font-black tracking-widest whitespace-nowrap"
      [attr.title]="'gestionProcesos.table.manualSyncHint' | transloco"
    >
      {{ 'gestionProcesos.table.manualSync' | transloco }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessManualSyncBadgeComponent {}
