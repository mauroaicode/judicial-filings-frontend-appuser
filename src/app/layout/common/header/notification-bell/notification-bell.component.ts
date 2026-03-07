import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
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
})
export class NotificationBellComponent implements OnInit {
    private _notificationService = inject(NotificationService);

    public notifications = this._notificationService.notifications;
    public unreadCount = this._notificationService.unreadCount;

    public currentPage = signal<number>(1);
    public hasLoaded = signal<boolean>(false);

    ngOnInit(): void {
      this._notificationService.getNotifications(1).subscribe();
    }

    onDropdownOpen(): void {
        if (!this.hasLoaded()) {
            this._notificationService.getNotifications(this.currentPage()).subscribe(() => {
                this.hasLoaded.set(true);
            });
        }
    }

    onNotificationClick(notification: AppNotification): void {
        if (!notification.read_at) {
            this._notificationService.markAsRead(notification.id).subscribe();
        }
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString();
    }
}
