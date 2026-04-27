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
    link: '/gestion-procesos',
  },
  {
    id: 'actuaciones-recientes',
    title: 'actuacionesRecientes.title',
    type: 'basic',
    icon: 'bell',
    link: '/actuaciones-recientes',
  },
  {
    id: 'keywords',
    title: 'navigation.keywords',
    type: 'basic',
    icon: 'keywords',
    link: '/palabras-clave',
  },
  {
    id: 'tasks',
    title: 'tasks.title',
    type: 'basic',
    icon: 'tasks',
    link: '/tareas',
  },
  {
    id: 'historial-importaciones',
    title: 'navigation.importHistory',
    type: 'basic',
    icon: 'import-history',
    link: '/historial-importaciones',
  },
  // More items will be added here as needed
];

