import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
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
    @ViewChild('notificationBellTrigger') private _notificationBellTrigger?: ElementRef<HTMLElement>;

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
        this._closeDropdown();

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
        'import-report': (item) => {
          const importId = item.data?.id;
          if (!importId) {
            return {
              commands: ['/historial-importaciones'],
            };
          }
          return {
            commands: ['/historial-importaciones'],
            queryParams: { import: importId },
          };
        },
        // Radicado importado: data.id (o process_id) = UUID del proceso → /gestion-procesos/{id}
        'process-imported': (item) => this._resolveProcessNavigation(item),
        'process_imported': (item) => this._resolveProcessNavigation(item),
        'task-reminder': (item) => this._resolveTaskNavigation(item),
        'task_reminder': (item) => this._resolveTaskNavigation(item),
        'task-urgency': (item) => this._resolveTaskNavigation(item),
        'task': (item) => this._resolveTaskNavigation(item),
        'action-documents': (item) => this._resolveDocumentsNavigation(item),
        'action_documents': (item) => this._resolveDocumentsNavigation(item),
        'actuacion_documento': (item) => this._resolveDocumentsNavigation(item),
        'new-documents': (item) => this._resolveDocumentsNavigation(item),
        'new_documents': (item) => this._resolveDocumentsNavigation(item),
        'ActionDocumentsAvailable': (item) => this._resolveDocumentsNavigation(item),
      };

      const resolver = notificationType ? routeResolvers[notificationType] : null;
      if (resolver) {
        return resolver(notification);
      }

      if (notification.data?.task_id) {
        return this._resolveTaskNavigation(notification);
      }

      // Document upload payloads may only carry media_id + process_id
      if (notification.data?.process_id && notification.data?.media_id != null) {
        return this._resolveDocumentsNavigation(notification);
      }

      if (notification.data?.process_id) {
        return this._resolveProcessNavigation(notification);
      }

      return null;
    }

    private _resolveDocumentsNavigation(
      notification: AppNotification
    ): { commands: string[]; queryParams?: Record<string, string> } | null {
      const processId = notification.data?.process_id;
      if (!processId) return null;

      const queryParams: Record<string, string> = { section: 'documents' };
      const actionId = notification.data?.action_id;
      if (actionId) {
        queryParams['actionId'] = actionId;
      }
      const mediaId = notification.data?.media_id;
      if (mediaId != null && String(mediaId).trim() !== '') {
        queryParams['mediaId'] = String(mediaId);
      }
      const filename =
        notification.data?.original_filename || notification.data?.filename;
      if (filename) {
        queryParams['filename'] = filename;
      }

      return {
        commands: ['/gestion-procesos', processId],
        queryParams,
      };
    }

    private _resolveProcessNavigation(
      notification: AppNotification
    ): { commands: string[]; queryParams?: Record<string, string> } | null {
      // process-imported envía el UUID del proceso en data.id; otros tipos usan process_id
      const processId = notification.data?.process_id ?? notification.data?.id;
      if (!processId) return null;
      return { commands: ['/gestion-procesos', processId] };
    }

    private _resolveTaskNavigation(
      notification: AppNotification
    ): { commands: string[]; queryParams?: Record<string, string> } | null {
      const taskId = notification.data?.task_id;
      if (!taskId) return null;

      return {
        commands: ['/tareas'],
        queryParams: { task: taskId },
      };
    }

    private _closeDropdown(): void {
      this._notificationBellTrigger?.nativeElement.blur();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
}
