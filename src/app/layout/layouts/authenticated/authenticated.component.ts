import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewChild,
  ViewEncapsulation,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
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
  private _activatedRoute = inject(ActivatedRoute);
  private _authService = inject(AuthService);

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

    // 1. Try to get title from route data (Deep traversal)
    let route = this._router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const dataTitle = route.snapshot.data['title'];
    if (dataTitle) {
      return dataTitle;
    }

    // 2. Fallback to explicit mapping if route data is missing
    if (url.includes('/gestion-procesos/')) return 'processDetail.title';
    if (url.includes('/gestion-procesos')) return 'navigation.gestionProcesos';
    if (url.includes('/palabras-clave')) return 'navigation.keywords';
    if (url.includes('/dashboard')) return 'navigation.dashboard';

    return '';
  });

  constructor() {
    // Initial scroll reset and title update will happen in ngOnInit
  }

  ngOnInit(): void {
    // Update state on navigation
    this._router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        // Sync URL signal
        this._currentUrl.set(event.urlAfterRedirects || event.url);

        // Reset scroll state
        this.pageScrolled.set(false);

        // Reset scroll position
        const mainEl = document.querySelector('main');
        if (mainEl) {
          mainEl.scrollTo(0, 0);
        }
      });

    // Initial sync
    setTimeout(() => {
      this._currentUrl.set(this._router.url);
    }, 100);
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
   * Handle scrolling on the main content area
   */
  onMainScroll(event: Event): void {
    const target = event.target as HTMLElement;
    // Set scrolled to true if we scrolled down a bit (e.g. 30px)
    this.pageScrolled.set(target.scrollTop > 30);
  }


}

