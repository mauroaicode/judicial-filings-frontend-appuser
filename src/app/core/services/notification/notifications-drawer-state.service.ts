import { Injectable, signal, computed } from '@angular/core';
import type { OrganizationNotificationType } from './organization-notification.service';

/**
 * Global state for the notifications drawer. Used so the stats cards
 * can open the drawer directly without relying on output/input chain.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationsDrawerStateService {
  private _open = signal<boolean>(false);
  private _type = signal<OrganizationNotificationType | null>(null);

  readonly open = this._open.asReadonly();
  readonly type = this._type.asReadonly();
  readonly isOpen = computed(() => this._open() && this._type() !== null);

  openDrawer(type: OrganizationNotificationType): void {
    this._type.set(type);
    this._open.set(true);
  }

  closeDrawer(): void {
    this._open.set(false);
    this._type.set(null);
    document.body.classList.remove('notifications-drawer-body-open');
  }
}
