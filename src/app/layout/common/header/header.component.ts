import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@app/core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { SessionLockService } from '@app/core/services/session-lock/session-lock.service';
import { PageHeaderContextService } from '@app/core/services/layout/page-header-context.service';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { ProcessAlertTooltipComponent } from '@app/shared/components/process-alert-tooltip/process-alert-tooltip.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, NotificationBellComponent, RouterLink, ProcessNumberPipe, ProcessAlertTooltipComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private _authService = inject(AuthService);
  private _router = inject(Router);
  private _sessionLockService = inject(SessionLockService);
  private _headerContext = inject(PageHeaderContextService);

  // Inputs
  public pageTitle = input<string>('');
  public sidebar = input<SidebarComponent | null>(null);
  public isScrolled = input<boolean>(false);

  // Outputs
  public toggleSidebar = output<void>();

  // User data
  public currentUser = this._authService.user;

  readonly processDetailHeader = this._headerContext.processDetailContext;

  readonly showCompactProcess = computed(
    () => this._headerContext.compactVisible() && this.processDetailHeader() !== null
  );

  readonly copiedMessage = signal<string | null>(null);

  copyProcessNumber(processNumber: string, event: MouseEvent): void {
    event.stopPropagation();

    if (!processNumber || processNumber === '–') {
      return;
    }

    const cleanText = processNumber.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(cleanText).then(() => {
      this.copiedMessage.set('notificationsDrawer.copiedToClipboard');
      setTimeout(() => this.copiedMessage.set(null), 2200);
    });
  }

  /**
   * Toggle sidebar
   */
  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  /**
   * Lock session manually from header action
   */
  lockSession(): void {
    this._sessionLockService.lock();
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await this._authService.signOut();
      await this._router.navigate(['/sign-in']);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}

