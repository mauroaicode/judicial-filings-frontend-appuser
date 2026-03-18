import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { AppNotification, NotificationResponse, UnreadCountResponse } from '@app/core/models/notification/notification.model';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private _httpClient = inject(HttpClient);

    // State
    private _notifications = signal<AppNotification[]>([]);
    private _unreadCount = signal<number>(0);

    // Events
    private _refreshProcesses$ = new Subject<void>();
    public readonly refreshProcesses$ = this._refreshProcesses$.asObservable();

    public readonly notifications = this._notifications.asReadonly();
    public readonly unreadCount = this._unreadCount.asReadonly();

    /**
     * Fetch unread count from API
     */
    getUnreadCount(): Observable<UnreadCountResponse> {
        const url = `${environment.apiBaseUrl}/notifications/unread-count`;
        return this._httpClient.get<UnreadCountResponse>(url).pipe(
            tap(res => this._unreadCount.set(res.unread_count))
        );
    }

  /**
   * Fetch latest notifications
   */
  getNotifications(page: number = 1): Observable<NotificationResponse> {
    const url = `${environment.apiBaseUrl}/notifications?page=${page}`;
    return this._httpClient.get<NotificationResponse>(url).pipe(
      tap((res: any) => {
        // Laravel pagination response might be nested (res.data.data) or simple (res.data)
        const items = Array.isArray(res.data) ? res.data : (res.data?.data || []);

        if (page === 1) {
          this._notifications.set(items);
        } else {
          this._notifications.update(current => [...current, ...items]);
        }
      })
    );
  }

    /**
     * Mark a notification as read
     */
    markAsRead(id: string): Observable<any> {
        const url = `${environment.apiBaseUrl}/notifications/${id}/read`;
        return this._httpClient.post(url, {}).pipe(
            tap(() => {
                // Update local state
                this._notifications.update(current =>
                    current.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
                );
                // Decrease unread count
                this._unreadCount.update(count => Math.max(0, count - 1));
            })
        );
    }

    /**
     * Handle incoming WebSocket notification
     */
    handleIncomingNotification(payload: any): void {
        // Detailed debug logs for troubleshooting
        console.log('--- [DEBUG] NEW NOTIFICATION RECEIVED ---');
        console.log('Full Payload Structure:', JSON.stringify(payload, null, 2));

        // Attempt to extract business type from all possible locations in the payload
        const businessType = payload.type || payload.data?.type || payload.notification_type || payload.data?.notification_type;
        const status = payload.status || payload.data?.status;

        console.log('--- [DEBUG] EXTRACTED VALUES ---');
        console.log('Business Type:', businessType);
        console.log('Status:', status);
        console.log('-----------------------------------------');

        const newNotification: AppNotification = {
            id: payload.id || payload.data?.id,
            type: businessType || 'BroadcastNotificationCreated',
            notifiable_type: '',
            notifiable_id: '',
            data: {
                title: payload.title || payload.data?.title,
                description: payload.description || payload.data?.description,
                type: businessType,
                id: payload.id_resource || payload.id || payload.data?.id,
                status: status
            },
            read_at: null,
            created_at: new Date().toISOString(),
            created_at_human: 'Justo ahora'
        };

        // Update state live
        this._notifications.update(current => [newNotification, ...current]);
        this._unreadCount.update(count => count + 1);

        /**
         * Refresh Logic
         * Trigger refresh for judicial updates or completed imports
         */
        const typesToRefresh = [
            'ProcessImportFinished',
            'JudicialActionDetected',
            'ConsolidatedJudicialActions',
            'import-report',
            'new-action',
            'alert-keyword',
            'actuacion_alerta',
            'actuacion'
        ];

        const shouldRefresh = typesToRefresh.includes(businessType);
        console.log(`[DEBUG] Result: shouldRefresh = ${shouldRefresh}`);

        if (shouldRefresh) {
            // Small delay to ensure DB consistency on backend before fetching
            setTimeout(() => {
                console.log('[DEBUG] Refreshing frontend data...');
                this._refreshProcesses$.next();
            }, 800);
        }
    }
}
