import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotificationService } from '@app/core/services/notification/notification.service';
import { AppNotification } from '@app/core/models/notification/notification.model';

@Component({
    selector: 'app-notification-bell',
    standalone: true,
    imports: [CommonModule, TranslocoPipe],
    templateUrl: './notification-bell.component.html',
    styleUrls: ['./notification-bell.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent implements OnInit {
    private _notificationService = inject(NotificationService);
    private _router = inject(Router);
    private _lastOpenRequestAt = 0;

    public notifications = this._notificationService.notifications;
    public newCount = this._notificationService.newCount;

    public currentPage = signal<number>(1);
    public hasLoaded = signal<boolean>(false);
    public activeTab = signal<'all' | 'unread'>('all');

    public filteredNotifications = computed(() => {
      const all = this.notifications();
      if (this.activeTab() === 'unread') {
        return all.filter(notification => !notification.read_at);
      }
      return all;
    });

    ngOnInit(): void {
      this._notificationService.getUnreadCount().subscribe();
      this._notificationService.getNotifications(1).subscribe();
      this.hasLoaded.set(true);
    }

    onDropdownOpen(): void {
        const now = Date.now();
        if (now - this._lastOpenRequestAt < 300) {
          return;
        }
        this._lastOpenRequestAt = now;

        this._notificationService.markAllAsOpened().subscribe();
        this._notificationService.getUnreadCount().subscribe();

        // Always reload when opening, so relative timestamps stay fresh.
        this.currentPage.set(1);
        this._notificationService.getNotifications(1).subscribe(() => {
            this.hasLoaded.set(true);
        });
    }

    onDropdownFocus(): void {
      this.onDropdownOpen();
    }

    onNotificationClick(notification: AppNotification): void {
        const navigation = this._resolveNotificationNavigation(notification);
        const navigateToTarget = (): void => {
          if (!navigation) return;
          this._router.navigate(navigation.commands, {
            queryParams: navigation.queryParams,
          });
        };

        if (!notification.read_at) {
            this._notificationService.markAsRead(notification.id).subscribe({
              next: () => navigateToTarget(),
              error: () => navigateToTarget(),
            });
            return;
        }

        navigateToTarget();
    }

    setTab(tab: 'all' | 'unread'): void {
      this.activeTab.set(tab);
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString();
    }

    private _resolveNotificationNavigation(
      notification: AppNotification
    ): { commands: string[]; queryParams?: Record<string, string> } | null {
      const notificationType = notification.data?.type;

      const routeResolvers: Record<
        string,
        (item: AppNotification) => { commands: string[]; queryParams?: Record<string, string> } | null
      > = {
        'consolidated-digest': (item) => {
          const digestId = item.data?.id ?? item.data?.digest_id;
          if (!digestId) return null;
          return {
            commands: ['/actuaciones-recientes'],
            queryParams: { digest: digestId },
          };
        },
      };

      const resolver = notificationType ? routeResolvers[notificationType] : null;
      return resolver ? resolver(notification) : null;
    }
}
