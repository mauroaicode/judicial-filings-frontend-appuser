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
import {
  DashboardStats,
  DashboardStatsCardType,
  SemaphoreColor,
} from '@app/core/models/dashboard/dashboard-stats.model';
import { NotificationsDrawerStateService } from '@app/core/services/notification/notifications-drawer-state.service';
import type { OrganizationNotificationType } from '@app/core/services/notification/organization-notification.service';

export type DashboardStatsCardsVariant = 'dashboard' | 'gestion-procesos';

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

export interface SemaphoreStatItem {
  color: SemaphoreColor;
  value: number;
  labelKey: string;
  subtitleKey: string;
}

const NOTIFICATION_CARD_TYPES: DashboardStatsCardType[] = ['actuacion', 'actuacion_alerta'];
const SEMAPHORE_ORDER: SemaphoreColor[] = ['red', 'yellow', 'green'];

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
  /** Layout variant: gestion-procesos prioritizes semaphores */
  variant = input<DashboardStatsCardsVariant>('dashboard');
  /** Active severity_color filter (for gestion-procesos highlight) */
  activeSeverityColor = input<string | null>(null);

  /** Emitted when a card is clicked (for compatibility) */
  cardClick = output<DashboardStatsCardType>();
  /** Emitted when a semaphore segment is clicked */
  semaphoreClick = output<SemaphoreColor>();

  readonly isGestionProcesos = computed(() => this.variant() === 'gestion-procesos');

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

  readonly semaphoreItems = computed<SemaphoreStatItem[]>(() => {
    const s = this.stats();
    if (!s) return [];

    const semaphores = s.semaphores ?? { red: 0, yellow: 0, green: 0 };

    return SEMAPHORE_ORDER.map((color) => ({
      color,
      value: semaphores[color],
      labelKey: `dashboard.stats.semaphores.${color}.title`,
      subtitleKey: `dashboard.stats.semaphores.${color}.subtitle`,
    }));
  });

  readonly semaphoreTotal = computed(() =>
    this.semaphoreItems().reduce((sum, item) => sum + item.value, 0)
  );

  /** Regular informational cards */
  readonly regularCards = computed(() =>
    this._allCards().filter(c => !NOTIFICATION_CARD_TYPES.includes(c.type))
  );

  /** High priority actionable cards */
  readonly importantCards = computed(() =>
    this._allCards().filter(c => NOTIFICATION_CARD_TYPES.includes(c.type))
  );

  isSemaphoreActive(color: SemaphoreColor): boolean {
    return this.activeSeverityColor() === color;
  }

  getSemaphoreBarWidth(color: SemaphoreColor): number {
    const total = this.semaphoreTotal();
    if (total === 0) return 0;
    const item = this.semaphoreItems().find(s => s.color === color);
    return item ? (item.value / total) * 100 : 0;
  }

  onCardClick(item: DashboardStatsCardItem): void {
    if (item.clickable && NOTIFICATION_CARD_TYPES.includes(item.type)) {
      this._drawerState.openDrawer(item.type as OrganizationNotificationType);
      this.cardClick.emit(item.type);
    }
  }

  onSemaphoreClick(color: SemaphoreColor): void {
    this.semaphoreClick.emit(color);
  }
}
