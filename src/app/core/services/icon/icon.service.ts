import { Injectable } from '@angular/core';

/**
 * Icon Service
 * Provides SVG paths for Heroicons
 * Using Heroicons v2 outline style
 */
@Injectable({
  providedIn: 'root',
})
export class IconService {
  /**
   * Icon paths map - Heroicons v2 outline style
   */
  private readonly iconPaths: Record<string, string> = {
    // Dashboard
    dashboard: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    
    // Gestión de Procesos - DocumentText icon (Heroicons v2 outline)
    'gestion-procesos': 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm.75 11.25h-6.75a.75.75 0 010-1.5h6.75a.75.75 0 010 1.5zm0-3h-6.75a.75.75 0 010-1.5h6.75a.75.75 0 010 1.5zm0-3h-6.75a.75.75 0 010-1.5h6.75a.75.75 0 010 1.5z',
    
    // Folder icon (alternative)
    folder: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
    
    // Document icon (alternative)
    document: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    
    // Menu/Hamburger
    menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
    
    // Close/X
    close: 'M6 18L18 6M6 6l12 12',
    
    // Chevron down
    'chevron-down': 'M19.5 8.25l-7.5 7.5-7.5-7.5',
  };

  /**
   * Get SVG path for an icon
   * @param iconName - Name of the icon
   * @returns SVG path string or empty string if not found
   */
  getIconPath(iconName: string): string {
    return this.iconPaths[iconName] || '';
  }

  /**
   * Check if an icon exists
   * @param iconName - Name of the icon
   * @returns true if icon exists
   */
  hasIcon(iconName: string): boolean {
    return iconName in this.iconPaths;
  }

  /**
   * Get all available icon names
   * @returns Array of icon names
   */
  getAvailableIcons(): string[] {
    return Object.keys(this.iconPaths);
  }
}
