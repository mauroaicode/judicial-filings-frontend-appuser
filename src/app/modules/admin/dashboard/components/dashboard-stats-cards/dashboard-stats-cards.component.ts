import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardStats, DashboardStatsCardType } from '@app/core/models/dashboard/dashboard-stats.model';
import { NotificationsDrawerStateService } from '@app/core/services/notification/notifications-drawer-state.service';
import type { OrganizationNotificationType } from '@app/core/services/notification/organization-notification.service';

export interface DashboardStatsCardItem {
  type: DashboardStatsCardType;
  value: number;
  labelKey: string;
  /** i18n key for the small subtitle below the value (regular cards only) */
  subtitleKey: string;
  /** DaisyUI class for value and icon (e.g. text-primary, text-error) */
  valueClass: string;
  /** Tailwind class for the colored dot indicator */
  dotClass: string;
  /** Accessible and clickable (opens notifications drawer) */
  clickable: boolean;
}

const NOTIFICATION_CARD_TYPES: DashboardStatsCardType[] = ['actuacion', 'actuacion_alerta'];

@Component({
  selector: 'app-dashboard-stats-cards',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './dashboard-stats-cards.component.html',
  styleUrls: ['./dashboard-stats-cards.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardStatsCardsComponent {
  private _drawerState = inject(NotificationsDrawerStateService);

  /** Stats from parent (from DashboardService.stats()) */
  stats = input.required<DashboardStats | null>();
  loading = input(false);
  error = input<string | null>(null);

  /** Emitted when a card is clicked (for compatibility) */
  cardClick = output<DashboardStatsCardType>();

  /** All defined cards */
  private readonly _allCards = computed<DashboardStatsCardItem[]>(() => {
    const s = this.stats();
    if (!s) return [];

    const byType = s.notifications?.by_type ?? {
      actuacion: 0,
      actuacion_alerta: 0,
    };

    return [
      {
        type: 'total_processes',
        value: s.total_processes,
        labelKey: 'dashboard.stats.totalProcesses',
        subtitleKey: 'dashboard.stats.totalProcessesSubtitle',
        valueClass: 'text-warning',
        dotClass: 'bg-warning',
        clickable: false,
      },
      {
        type: 'active_processes',
        value: s.active_processes,
        labelKey: 'dashboard.stats.activeProcesses',
        subtitleKey: 'dashboard.stats.activeProcessesSubtitle',
        valueClass: 'text-success',
        dotClass: 'bg-success',
        clickable: false,
      },
      {
        type: 'inactive_processes',
        value: s.inactive_processes,
        labelKey: 'dashboard.stats.inactiveProcesses',
        subtitleKey: 'dashboard.stats.inactiveProcessesSubtitle',
        valueClass: 'text-error',
        dotClass: 'bg-error',
        clickable: false,
      },
      {
        type: 'processes_with_multiple_instances',
        value: s.processes_with_multiple_instances ?? 0,
        labelKey: 'dashboard.stats.multipleInstancesTotal',
        subtitleKey: 'dashboard.stats.multipleInstancesSubtitle',
        valueClass: 'text-secondary',
        dotClass: 'bg-secondary',
        clickable: false,
      },
      {
        type: 'actuacion',
        value: byType.actuacion,
        labelKey: 'dashboard.stats.notifications.actuacion',
        subtitleKey: 'dashboard.stats.notifications.actuacionSubtitle',
        valueClass: 'text-info',
        dotClass: 'bg-sky-500',
        clickable: true,
      },
      {
        type: 'actuacion_alerta',
        value: byType.actuacion_alerta,
        labelKey: 'dashboard.stats.notifications.actuacionAlerta',
        subtitleKey: 'dashboard.stats.notifications.actuacionAlertaSubtitle',
        valueClass: 'text-warning',
        dotClass: 'bg-amber-500',
        clickable: true,
      },
    ];
  });

  /** Regular informational cards */
  readonly regularCards = computed(() =>
    this._allCards().filter(c => !NOTIFICATION_CARD_TYPES.includes(c.type))
  );

  /** High priority actionable cards */
  readonly importantCards = computed(() =>
    this._allCards().filter(c => NOTIFICATION_CARD_TYPES.includes(c.type))
  );

  onCardClick(item: DashboardStatsCardItem): void {
    if (item.clickable && NOTIFICATION_CARD_TYPES.includes(item.type)) {
      this._drawerState.openDrawer(item.type as OrganizationNotificationType);
      this.cardClick.emit(item.type);
    }
  }
}
