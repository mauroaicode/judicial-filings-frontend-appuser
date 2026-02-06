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
  /** DaisyUI class for value and icon (e.g. text-primary, text-error) */
  valueClass: string;
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

  readonly cards = computed<DashboardStatsCardItem[]>(() => {
    const s = this.stats();
    if (!s) return [];

    const byType = s.notifications?.by_type ?? {
      actuacion: 0,
      actuacion_alerta: 0,
    };

    const cardsList: DashboardStatsCardItem[] = [
      {
        type: 'total_processes',
        value: s.total_processes,
        labelKey: 'dashboard.stats.totalProcesses',
        valueClass: 'text-warning',
        clickable: false,
      },
      {
        type: 'active_processes',
        value: s.active_processes,
        labelKey: 'dashboard.stats.activeProcesses',
        valueClass: 'text-success',
        clickable: false,
      },
      {
        type: 'inactive_processes',
        value: s.inactive_processes,
        labelKey: 'dashboard.stats.inactiveProcesses',
        valueClass: 'text-error',
        clickable: false,
      },
      {
        type: 'actuacion',
        value: byType.actuacion,
        labelKey: 'dashboard.stats.notifications.actuacion',
        valueClass: 'text-info',
        clickable: true,
      },
      {
        type: 'actuacion_alerta',
        value: byType.actuacion_alerta,
        labelKey: 'dashboard.stats.notifications.actuacionAlerta',
        valueClass: 'text-orange',
        clickable: true,
      },
    ];
    return cardsList;
  });

  onCardClick(item: DashboardStatsCardItem): void {
    if (item.clickable && NOTIFICATION_CARD_TYPES.includes(item.type)) {
      this._drawerState.openDrawer(item.type as OrganizationNotificationType);
      this.cardClick.emit(item.type);
    }
  }
}
