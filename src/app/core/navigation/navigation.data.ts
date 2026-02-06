import { NavigationItem } from '@app/core/models/navigation/navigation-item.model';

/**
 * Default navigation items
 * This will be filtered by roles in the navigation service
 */
export const DEFAULT_NAVIGATION: NavigationItem[] = [
  {
    id: 'gestion-procesos',
    title: 'navigation.gestionProcesos',
    type: 'basic',
    icon: 'gestion-procesos',
    link: '/admin/gestion-procesos',
  },
  // More items will be added here as needed
];

