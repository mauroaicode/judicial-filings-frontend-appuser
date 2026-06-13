import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewChild,
  ViewEncapsulation,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, Location, PlatformLocation } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { filter, tap } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { SidebarComponent } from '@app/layout/common/sidebar/sidebar.component';
import { HeaderComponent } from '@app/layout/common/header/header.component';
import { NotificationsComponent } from '@app/layout/common/notifications/notifications.component';
import { AuthService } from '@app/core/auth/auth.service';
import { AlertComponent } from '@app/shared/components/alert/alert.component';
import { SessionLockService } from '@app/core/services/session-lock/session-lock.service';
import { SessionLockModalComponent } from '@app/shared/components/session-lock-modal/session-lock-modal.component';
import { PageHeaderContextService } from '@app/core/services/layout/page-header-context.service';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    NotificationsComponent,
    AlertComponent,
    SessionLockModalComponent,
  ],
  templateUrl: './authenticated.component.html',
  styleUrls: ['./authenticated.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent implements OnInit {
  private _router = inject(Router);
  private _authService = inject(AuthService);
  private _sessionLockService = inject(SessionLockService);
  private _location = inject(Location);
  private _platformLocation = inject(PlatformLocation);
  private _destroyRef = inject(DestroyRef);
  private _headerContext = inject(PageHeaderContextService);

  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  // Check if user must change password
  public mustChangePassword = computed(() => this._authService.user()?.must_change_password ?? false);

  // State signals
  private _routeRevision = signal(0);
  public sidebarOpen = signal<boolean>(true);
  public pageScrolled = signal<boolean>(false);
  public sessionLocked = this._sessionLockService.isLocked;

  // Computed page title — derived from live Router URL (zoneless-safe)
  public pageTitle = computed(() => {
    this._routeRevision();
    const path = this._router.url.split('?')[0].split('#')[0];
    return this._titleFromUrl(path) ?? this._titleFromSnapshot(this._router.routerState.snapshot.root) ?? '';
  });

  private _titleFromUrl(path: string): string | undefined {
    const normalized = path.replace(/\/$/, '') || '/';

    if (/^\/gestion-procesos\/[^/]+$/.test(normalized)) {
      return 'processDetail.title';
    }
    if (normalized === '/gestion-procesos') {
      return 'navigation.gestionProcesos';
    }
    if (path.includes('/actuaciones-recientes')) return 'actuacionesRecientes.title';
    if (path.includes('/palabras-clave')) return 'navigation.keywords';
    if (path.includes('/tareas')) return 'tasks.title';
    if (path.includes('/perfil')) return 'header.profile';
    if (path.includes('/historial-importaciones')) return 'historialImportaciones.title';
    if (path.includes('/dashboard')) return 'navigation.dashboard';
    return undefined;
  }

  private _titleFromSnapshot(root: ActivatedRouteSnapshot): string | undefined {
    let deepest = root;
    while (deepest.firstChild) {
      deepest = deepest.firstChild;
    }
    let s: ActivatedRouteSnapshot | null = deepest;
    while (s) {
      const t = s.data['title'];
      if (typeof t === 'string' && t.length > 0) {
        return t;
      }
      s = s.parent;
    }
    return undefined;
  }
  /** Re-sync header title from the current router URL (e.g. after browser back). */
  public syncPageTitleFromRouter(): void {
    this._routeRevision.update((v) => v + 1);
  }

  private _scheduleTitleSync(delayed = false): void {
    const sync = () => this.syncPageTitleFromRouter();
    if (delayed) {
      setTimeout(sync, 0);
    } else {
      sync();
    }
  }
  
  constructor() {
    this._router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        tap(() => {
          this._scheduleTitleSync();
          const path = this._router.url.split('?')[0].split('#')[0];
          if (!/^\/gestion-procesos\/[^/]+$/.test(path.replace(/\/$/, '') || '/')) {
            this._headerContext.clearProcessDetail();
          }
        }),
        takeUntilDestroyed()
      )
      .subscribe();
  }

  ngOnInit(): void {
    this._sessionLockService.initializeFromCurrentUser();

    // Browser back/forward: router.url may update after popstate
    this._platformLocation.onPopState(() => this._scheduleTitleSync(true));

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        this._scheduleTitleSync(true);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    this._destroyRef.onDestroy(() => window.removeEventListener('pageshow', onPageShow));

    const removeUrlChange = this._location.onUrlChange(() => this._scheduleTitleSync(true));
    this._destroyRef.onDestroy(() => removeUrlChange());

    this.syncPageTitleFromRouter();

    // Initial scroll reset
    this._router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        // Reset scroll state
        this.pageScrolled.set(false);
        this._headerContext.setCompactVisible(false);

        // Reset scroll position
        const mainEl = document.querySelector('main');
        if (mainEl) {
          mainEl.scrollTo(0, 0);
        }
      });
  }

  /**
   * Toggle sidebar
   */
  onToggleSidebar(): void {
    if (this.sidebar) {
      this.sidebar.toggleSidebar();
      this.sidebarOpen.set(this.sidebar.isOpen());
    }
  }

  /**
   * Force close sidebar
   */
  closeSidebar(): void {
    if (this.sidebar && this.sidebar.isOpen()) {
      this.sidebar.closeSidebar();
      this.sidebarOpen.set(false);
    }
  }

  /**
   * Handle scrolling on the main content area
   */
  onMainScroll(event: Event): void {
    const target = event.target as HTMLElement;
    // Set scrolled to true if we scrolled down a bit (e.g. 30px)
    this.pageScrolled.set(target.scrollTop > 30);
  }


}

