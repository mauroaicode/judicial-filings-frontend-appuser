import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewChild,
  ViewEncapsulation,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { filter, tap } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { SidebarComponent } from '@app/layout/common/sidebar/sidebar.component';
import { HeaderComponent } from '@app/layout/common/header/header.component';
import { NotificationsComponent } from '@app/layout/common/notifications/notifications.component';
import { AuthService } from '@app/core/auth/auth.service';
import { AlertComponent } from '@app/shared/components/alert/alert.component';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, NotificationsComponent, AlertComponent],
  templateUrl: './authenticated.component.html',
  styleUrls: ['./authenticated.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent implements OnInit {
  private _router = inject(Router);
  private _authService = inject(AuthService);
  private _cdr = inject(ChangeDetectorRef);

  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  // Check if user must change password
  public mustChangePassword = computed(() => this._authService.user()?.must_change_password ?? false);

  // State signals
  private _currentUrl = signal<string>(this._router.url);
  public sidebarOpen = signal<boolean>(true);
  public pageScrolled = signal<boolean>(false);

  // Computed page title - Always in sync with URL and Router State
  public pageTitle = computed(() => {
    const url = this._currentUrl();

    // 1. title en data de la ruta hoja o de un ancestro (lazy + path '' suelen dejar el título en el padre)
    const dataTitle = this._titleFromSnapshot(this._router.routerState.snapshot.root);
    if (dataTitle) {
      return dataTitle;
    }

    // 2. Fallback si falta data en rutas
    if (url.includes('/gestion-procesos/')) return 'processDetail.title';
    if (url.includes('/gestion-procesos')) return 'navigation.gestionProcesos';
    if (url.includes('/palabras-clave')) return 'navigation.keywords';
    if (url.includes('/tareas')) return 'tasks.title';
    if (url.includes('/perfil')) return 'header.profile';
    if (url.includes('/dashboard')) return 'navigation.dashboard';

    return '';
  });

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
  
  constructor() {
    // Explicitly force change detection on every navigation end
    this._router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        tap((event) => {
          this._currentUrl.set(event.urlAfterRedirects || event.url);
          this._cdr.detectChanges();
        })
      )
      .subscribe();
  }

  ngOnInit(): void {
    // Initial sync
    setTimeout(() => {
      this._currentUrl.set(this._router.url);
      this._cdr.detectChanges();
    }, 100);

    // Initial scroll reset
    this._router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        // Reset scroll state
        this.pageScrolled.set(false);

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

