import { Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () => import('./config.component').then((m) => m.ConfigComponent),
    children: [
      {
        path: '',
        redirectTo: 'seguridad',
        pathMatch: 'full',
      },
      {
        path: 'seguridad',
        loadComponent: () => import('./pages/security-settings/security-settings.component').then((m) => m.SecuritySettingsComponent),
      },
      {
        path: 'canales',
        loadComponent: () => import('./pages/notification-channels/notification-channels.component').then((m) => m.NotificationChannelsComponent),
      }
    ]
  }
] as Routes;
