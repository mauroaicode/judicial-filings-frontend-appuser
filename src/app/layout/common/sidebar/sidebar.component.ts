import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { NavigationService } from '@app/core/navigation/navigation.service';
import { NavigationItem } from '@app/core/models/navigation/navigation-item.model';
import { STORAGE } from '@app/core/constants/storage.constant';
import { environment } from '@app/core/config/environment.config';
import { IconService } from '@app/core/services/icon/icon.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoPipe],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private _navigationService = inject(NavigationService);
  private _router = inject(Router);
  private _iconService = inject(IconService);

  // Sidebar state - load from localStorage or default to true
  public isOpen = signal<boolean>(this._loadSidebarState());
  public isMobile = signal<boolean>(false);

  // Navigation items
  public navigation = computed(() => this._navigationService.filteredNavigation());

  // Menu title from environment
  public menuTitle = environment.menuTitle;

  // Track expanded items for collapsable menus
  private _expandedItems = signal<Set<string>>(new Set());
  public currentUrl = signal<string>(this._router.url);
  public selectedMenuId = signal<string | null>(null);

  // Computed set of active item IDs based on current URL
  public activeIds = computed(() => {
    const url = this.currentUrl();
    const nav = this.navigation();
    const ids = new Set<string>();

    const normalizedUrl = url.split('?')[0].replace(/\/$/, '');

    const checkActive = (item: NavigationItem): boolean => {
      let active = false;
      if (item.link) {
        const normalizedLink = item.link.replace(/\/$/, '');
        active = normalizedUrl === normalizedLink || normalizedUrl.startsWith(normalizedLink + '/');
      }
      if (!active && item.children) {
        active = item.children.some(child => checkActive(child));
      }
      if (active) ids.add(item.id);
      return active;
    };

    nav.default.forEach(item => checkActive(item));
    return ids;
  });

  constructor() {
    // Initial active menu from current URL
    this._syncSelectedMenuFromUrl(this._router.url);

    // Keep selected menu synced with router URL
    this._router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const nextUrl = event.urlAfterRedirects || event.url || this._router.url;
        this.currentUrl.set(nextUrl);
        this._syncSelectedMenuFromUrl(nextUrl);
      });

    // Check if mobile on init and resize
    this._checkMobile();

    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile();
      this._checkMobile();
      // If switching from mobile to desktop, restore saved state
      if (wasMobile && !this.isMobile()) {
        const savedState = this._loadSidebarState();
        this.isOpen.set(savedState);
      }
      // If switching to mobile, close sidebar (but don't save)
      if (!wasMobile && this.isMobile()) {
        this.isOpen.set(false);
      }
    });

    // Initialize sidebar state based on screen size
    if (this.isMobile()) {
      // On mobile, always start closed
      this.isOpen.set(false);
    } else {
      // On desktop, load saved state
      const savedState = this._loadSidebarState();
      this.isOpen.set(savedState);
    }

    // Save sidebar state whenever it changes (only on desktop)
    effect(() => {
      const isOpenValue = this.isOpen();
      if (!this.isMobile()) {
        this._saveSidebarState(isOpenValue);
      }
    });

  }

  /**
   * Toggle sidebar open/close
   */
  toggleSidebar(): void {
    this.isOpen.update((value) => !value);
  }

  /**
   * Close sidebar (useful for mobile)
   */
  closeSidebar(): void {
    this.isOpen.set(false);
  }

  /**
   * Check if item is expanded
   */
  isItemExpanded(itemId: string): boolean {
    return this._expandedItems().has(itemId);
  }

  /**
   * Toggle item expansion
   */
  toggleItem(item: NavigationItem): void {
    if (item.type === 'collapsable' && item.children) {
      const expanded = this._expandedItems();
      if (expanded.has(item.id)) {
        expanded.delete(item.id);
      } else {
        expanded.add(item.id);
      }
      this._expandedItems.set(new Set(expanded));
    }
  }

  /**
   * Check if item is active
   */
  isItemActive(item: NavigationItem): boolean {
    if (!item.link && (!item.children || item.children.length === 0)) return false;

    // Read the currentUrl signal so Angular re-evaluates this function 
    // when the route changes under OnPush change detection
    this.currentUrl();

    // If the item has a link, check if it's active
    if (item.link && this._router.isActive(item.link, {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    })) {
      return true;
    }

    // If the item has children, check if any of them are active
    if (item.children) {
      return item.children.some(child => this.isItemActive(child));
    }

    return false;
  }

  /**
   * Check if a link should be highlighted as active.
   * Uses currentUrl signal directly to avoid one-step lag in zoneless mode.
   */
  isLinkActive(link?: string): boolean {
    if (!link) return false;
    const current = this._normalizePath(this.currentUrl());
    const target = this._normalizePath(link);
    return this._matchesPath(current, target);
  }

  isItemSelected(itemId: string): boolean {
    return this.selectedMenuId() === itemId;
  }

  private _normalizePath(url: string): string {
    return (url || '').split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  }

  private _matchesPath(current: string, target: string): boolean {
    return current === target || current.startsWith(`${target}/`);
  }

  onMenuItemClick(item: NavigationItem): void {
    this.selectedMenuId.set(item.id);
    if (this.isMobile()) this.closeSidebar();
  }

  private _syncSelectedMenuFromUrl(url: string): void {
    const normalized = this._normalizePath(url);
    const navItems = this.navigation().default;

    for (const item of navItems) {
      if (item.link && this._matchesPath(normalized, this._normalizePath(item.link))) {
        this.selectedMenuId.set(item.id);
        return;
      }

      if (item.children?.length) {
        for (const child of item.children) {
          if (child.link && this._matchesPath(normalized, this._normalizePath(child.link))) {
            this.selectedMenuId.set(child.id);
            return;
          }
        }
      }
    }
  }

  /**
   * Navigate to item link
   */
  navigateTo(item: NavigationItem): void {
    if (item.disabled || !item.link) return;

    // If collapsable, toggle instead of navigate
    if (item.type === 'collapsable' && item.children) {
      this.toggleItem(item);
      return;
    }

    // Navigate to link
    this._router.navigate([item.link]).then(() => {
      // Close sidebar on mobile after navigation
      if (this.isMobile()) {
        this.closeSidebar();
      }
    });
  }

  /**
   * Check if screen is mobile
   */
  private _checkMobile(): void {
    this.isMobile.set(window.innerWidth < 768);
  }

  /**
   * Load sidebar state from localStorage
   */
  private _loadSidebarState(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE.SIDEBAR_OPEN);
      if (saved !== null) {
        return saved === 'true';
      }
      // Default to open if no saved state
      return true;
    } catch (error) {
      console.error('Error loading sidebar state:', error);
      return true;
    }
  }

  /**
   * Save sidebar state to localStorage
   */
  private _saveSidebarState(isOpen: boolean): void {
    try {
      localStorage.setItem(STORAGE.SIDEBAR_OPEN, String(isOpen));
    } catch (error) {
      console.error('Error saving sidebar state:', error);
    }
  }

  /**
   * Get icon path for a navigation item
   * @param item - Navigation item
   * @returns SVG path string
   */
  getIconPath(item: NavigationItem): string {
    if (!item.icon) return '';
    return this._iconService.getIconPath(item.icon);
  }
}

