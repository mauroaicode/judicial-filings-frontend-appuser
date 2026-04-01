import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  output,
  signal,
  ViewEncapsulation,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { OrganizationNotificationService, OrganizationNotificationType } from '@app/core/services/notification/organization-notification.service';
import { NotificationsDrawerStateService } from '@app/core/services/notification/notifications-drawer-state.service';
import { DashboardService } from '@app/core/services/dashboard/dashboard.service';
import {
  OrganizationNotificationRow,
  OrganizationNotificationMeta,
  OrganizationNotificationSubject,
} from '@app/core/models/notification/organization-notification.model';
import { buildTextWithHighlights } from '@app/core/utils/alert-highlight.utils';
import { SafeHtmlPipe } from '@app/shared/pipes/safe-html.pipe';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';

const PER_PAGE = 20;
const SCROLL_LOAD_THRESHOLD = 200;
const MAX_SUBJECTS_PREVIEW = 3;
const TOAST_DURATION_MS = 4_000;

@Component({
  selector: 'app-notifications-drawer',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, SafeHtmlPipe, ConfirmationDialogComponent],
  templateUrl: './notifications-drawer.component.html',
  styleUrls: ['./notifications-drawer.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsDrawerComponent implements OnDestroy {
  private _notificationService = inject(OrganizationNotificationService);
  private _drawerState = inject(NotificationsDrawerStateService);
  private _transloco = inject(TranslocoService);
  private _dashboardService = inject(DashboardService);
  private _toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly isOpen = this._drawerState.isOpen;
  readonly notificationType = this._drawerState.type;

  closed = output<void>();
  rowClick = output<OrganizationNotificationRow>();

  @HostBinding('class.notifications-drawer-open') get isDrawerOpen(): boolean {
    return this.isOpen();
  }

  readonly rows = signal<OrganizationNotificationRow[]>([]);
  readonly pagination = signal<OrganizationNotificationMeta | null>(null);
  readonly loading = signal<boolean>(false);
  readonly loadingMore = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly hasMore = computed(() => {
    const meta = this.pagination();
    if (!meta) return false;
    return meta.current_page < meta.last_page;
  });

  readonly isActuacionOrAlerta = computed(() => {
    const t = this.notificationType();
    return t === 'actuacion' || t === 'actuacion_alerta';
  });

  /** Row IDs for which the full subject list is expanded */
  readonly expandedSubjectRows = signal<Set<string>>(new Set());
  /** Selected notification IDs for "mark as viewed" */
  readonly selectedIds = signal<Set<string>>(new Set());
  /** Confirmation dialog open and kind */
  readonly confirmOpen = signal<boolean>(false);
  readonly confirmKind = signal<'markAll' | 'markSelected' | null>(null);
  readonly markingInProgress = signal<boolean>(false);
  /** Success message after marking selected (e.g. "Se marcaron 2 como vistas") */
  readonly markedCountMessage = signal<string | null>(null);

  readonly selectedCount = computed(() => this.selectedIds().size);

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const type = this.notificationType();
      if (open && type) {
        this.rows.set([]);
        this.pagination.set(null);
        this.expandedSubjectRows.set(new Set());
        this.selectedIds.set(new Set());
        this.markedCountMessage.set(null);
        this.loadNotifications(type, 1, false);
        document.body.classList.add('notifications-drawer-body-open');
      } else {
        document.body.classList.remove('notifications-drawer-body-open');
      }
    });
  }

  close(): void {
    this._drawerState.closeDrawer();
    this.closed.emit();
  }

  onToggleChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!checked) {
      this._drawerState.closeDrawer();
      this.closed.emit();
    }
  }

  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (!el || !this.hasMore() || this.loadingMore() || this.loading()) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD) {
      this.loadMore();
    }
  }

  loadMore(): void {
    const type = this.notificationType();
    const meta = this.pagination();
    if (!type || !meta || meta.current_page >= meta.last_page) return;
    this.loadNotifications(type, meta.current_page + 1, true);
  }

  onItemClick(row: OrganizationNotificationRow): void {
    this.rowClick.emit(row);
  }

  formatDate(value: string): string {
    return this._formatDate(value);
  }

  getActionHtml(row: OrganizationNotificationRow): string {
    const type = this.notificationType();
    if (type === 'actuacion') {
      return row.action ?? '';
    }
    return buildTextWithHighlights(row.action ?? null, row.alert_highlights, 'action');
  }

  getAnnotationHtml(row: OrganizationNotificationRow): string {
    const type = this.notificationType();
    if (type === 'actuacion') {
      return row.annotation ?? '';
    }
    return buildTextWithHighlights(row.annotation ?? null, row.alert_highlights, 'annotation');
  }

  isSubjectsExpanded(rowId: string): boolean {
    return this.expandedSubjectRows().has(rowId);
  }

  toggleSubjects(rowId: string, event: Event): void {
    event.stopPropagation();
    this.expandedSubjectRows.update((set) => {
      const next = new Set(set);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  getVisibleSubjects(row: OrganizationNotificationRow): OrganizationNotificationSubject[] {
    const list = row.subjects ?? [];
    if (list.length === 0) return [];
    const expanded = this.expandedSubjectRows().has(row.id);
    return expanded ? list : list.slice(0, MAX_SUBJECTS_PREVIEW);
  }

  getRemainingSubjectsCount(row: OrganizationNotificationRow): number {
    const list = row.subjects ?? [];
    if (list.length <= MAX_SUBJECTS_PREVIEW) return 0;
    return list.length - MAX_SUBJECTS_PREVIEW;
  }

  isSelected(rowId: string): boolean {
    return this.selectedIds().has(rowId);
  }

  toggleSelection(rowId: string, event: Event): void {
    event.stopPropagation();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  openConfirmMarkAll(): void {
    this.confirmKind.set('markAll');
    this.confirmOpen.set(true);
  }

  openConfirmMarkSelected(): void {
    if (this.selectedCount() === 0) return;
    this.confirmKind.set('markSelected');
    this.confirmOpen.set(true);
  }

  getConfirmTitle(): string {
    const kind = this.confirmKind();
    if (kind === 'markAll') return this._transloco.translate('notificationsDrawer.confirm.markAllTitle');
    if (kind === 'markSelected') return this._transloco.translate('notificationsDrawer.confirm.markSelectedTitle');
    return '';
  }

  getConfirmMessage(): string {
    const kind = this.confirmKind();
    if (kind === 'markAll') {
      const total = this.pagination()?.total ?? this.rows().length;
      return this._transloco.translate('notificationsDrawer.confirm.markAllMessage', { total });
    }
    if (kind === 'markSelected') {
      return this._transloco.translate('notificationsDrawer.confirm.markSelectedMessage', {
        count: this.selectedCount(),
      });
    }
    return '';
  }

  onConfirmMarkViewed(): void {
    const kind = this.confirmKind();
    this.confirmOpen.set(false);
    this.confirmKind.set(null);
    if (!kind) return;

    const type = this.notificationType();
    if (!type) return;

    this.markingInProgress.set(true);

    if (kind === 'markAll') {
      this._notificationService.markAllViewed(type).subscribe({
        next: () => {
          this.markingInProgress.set(false);
          this._dashboardService.loadStats();
          this.loadNotifications(type, 1, false);
        },
        error: () => this.markingInProgress.set(false),
      });
      return;
    }

    const ids = Array.from(this.selectedIds());
    this._notificationService.markViewed(ids).subscribe({
      next: (res) => {
        this.markingInProgress.set(false);
        this.selectedIds.set(new Set());
        this._dashboardService.loadStats();
        const message = this._transloco.translate('notificationsDrawer.markedCountSuccess', {
          count: res.marked,
        });
        this.markedCountMessage.set(message);
        this._scheduleToastDismiss();
        this.loadNotifications(type, 1, false);
      },
      error: () => this.markingInProgress.set(false),
    });
  }

  ngOnDestroy(): void {
    if (this._toastTimeoutId != null) {
      clearTimeout(this._toastTimeoutId);
      this._toastTimeoutId = null;
    }
  }

  private _scheduleToastDismiss(): void {
    if (this._toastTimeoutId != null) {
      clearTimeout(this._toastTimeoutId);
    }
    this._toastTimeoutId = setTimeout(() => {
      this._toastTimeoutId = null;
      this.markedCountMessage.set(null);
    }, TOAST_DURATION_MS);
  }

  onCancelConfirm(): void {
    this.confirmOpen.set(false);
    this.confirmKind.set(null);
  }

  private _formatDate(value: string): string {
    if (!value) return '–';
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return value;
    const [, y, month, day] = m;
    return `${day}/${month}/${y}`;
  }

  copyToClipboard(text: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
      // Reuse the toast mechanism for feedback
      const originalMessage = this.markedCountMessage();
      this.markedCountMessage.set(this._transloco.translate('notificationsDrawer.copiedToClipboard'));
      
      setTimeout(() => {
        this.markedCountMessage.set(originalMessage);
      }, 2000);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  private loadNotifications(type: OrganizationNotificationType, page: number, append: boolean): void {
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    this._notificationService.getNotifications(type, page, PER_PAGE).subscribe({
      next: (response) => {
        const newRows = this._notificationService.mapToTableRows(type, response);
        if (append) {
          this.rows.update((prev) => [...prev, ...newRows]);
          this.loadingMore.set(false);
        } else {
          this.rows.set(newRows);
          this.loading.set(false);
        }
        this.pagination.set(response.meta);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar notificaciones');
        this.rows.set([]);
        this.pagination.set(null);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }
}
