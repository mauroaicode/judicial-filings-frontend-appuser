import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppTheme = 'light' | 'dark';

/**
 * Manages application color theme (light / dark).
 *
 * Priority order:
 *  1. User's saved preference (localStorage)
 *  2. OS / browser system preference (prefers-color-scheme)
 *  3. Default: light
 *
 * The active theme is stored as `data-theme` on <html> so DaisyUI picks it up
 * automatically. A MediaQueryList listener reacts to system changes only when
 * the user has not overridden the preference manually.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  static readonly STORAGE_KEY = 'notijudicial-theme';

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isDark = signal<boolean>(false);

  constructor() {
    if (this.isBrowser) {
      this._init();
    }
  }

  toggle(): void {
    const next = !this.isDark();
    try {
      localStorage.setItem(ThemeService.STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Silently ignore storage errors (e.g. private/incognito restrictions)
    }
    this._apply(next);
  }

  setTheme(theme: AppTheme): void {
    try {
      localStorage.setItem(ThemeService.STORAGE_KEY, theme);
    } catch { /* noop */ }
    this._apply(theme === 'dark');
  }

  private _init(): void {
    let saved: AppTheme | null = null;
    try {
      saved = localStorage.getItem(ThemeService.STORAGE_KEY) as AppTheme | null;
    } catch { /* noop */ }

    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved !== null ? saved === 'dark' : sysDark;

    this._apply(isDark);

    // React to OS-level changes only when the user hasn't saved a preference
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', ({ matches }) => {
        let hasSaved = false;
        try {
          hasSaved = localStorage.getItem(ThemeService.STORAGE_KEY) !== null;
        } catch { /* noop */ }
        if (!hasSaved) {
          this._apply(matches);
        }
      });
  }

  private _apply(isDark: boolean): void {
    this.isDark.set(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }
}
