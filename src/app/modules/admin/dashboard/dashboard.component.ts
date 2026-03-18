import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardService } from '@app/core/services/dashboard/dashboard.service';
import { DashboardStatsCardsComponent } from './components/dashboard-stats-cards/dashboard-stats-cards.component';
import { NotificationsDrawerComponent } from '@app/shared/components/notifications-drawer/notifications-drawer.component';
import { NotificationsDrawerStateService } from '@app/core/services/notification/notifications-drawer-state.service';
import { NotificationService } from '@app/core/services/notification/notification.service';
import type { OrganizationNotificationRow } from '@app/core/models/notification/organization-notification.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, DashboardStatsCardsComponent, NotificationsDrawerComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private _dashboardService = inject(DashboardService);
  private _router = inject(Router);

  private _drawerState = inject(NotificationsDrawerStateService);
  private _notificationService = inject(NotificationService);
  private _destroyRef = inject(DestroyRef);

  readonly stats = this._dashboardService.stats;
  readonly isLoading = this._dashboardService.isLoading;
  readonly error = this._dashboardService.error;

  constructor() {
    // Refresh stats when specified notifications arrive
    this._notificationService.refreshProcesses$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        console.log('Refreshing dashboard stats because of a notification...');
        this._dashboardService.loadStats();
      });
  }

  ngOnInit(): void {
    this._dashboardService.loadStats();
  }

  onNotificationsDrawerClosed(): void {
    this._drawerState.closeDrawer();
  }

  onNotificationRowClick(row: OrganizationNotificationRow): void {
    if (row?.process_id) {
      this._drawerState.closeDrawer();
      this._router.navigate(['/gestion-procesos', row.process_id]);
    }
  }
}

