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

    // Keywords - Tag icon
    keywords: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182L10.519 3.659A2.25 2.25 0 009.568 3zM6 6a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',

    // Plus - Add icon
    plus: 'M12 4.5v15m7.5-7.5h-15',

    // Pencil - Edit icon
    pencil: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125',

    // Trash - Delete icon
    trash: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.166L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',

    // Chevron down
    'chevron-down': 'M19.5 8.25l-7.5 7.5-7.5-7.5',

    // Bell - Notification icon
    bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',

    // Tasks icon - ClipboardDocumentList
    tasks: 'M9 12h3.75M9 15h3.75M9 18h3.75m3.375-13.5h1.5a2.25 2.25 0 0 1 2.25 2.25v13.5a2.25 2.25 0 0 1-2.25 2.25h-10.5a2.25 2.25 0 0 1-2.25-2.25V6.75a2.25 2.25 0 0 1 2.25-2.25h1.5M9 3.75h6c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H9a1.125 1.125 0 0 1-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125Z',

    // No Symbol icon
    'no-symbol': 'M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 1 1 5.636 5.636m12.728 12.728L5.636 5.636',
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
