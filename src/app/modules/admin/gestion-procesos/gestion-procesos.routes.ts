import { Routes } from '@angular/router';
import { GestionProcesosComponent } from './gestion-procesos.component';

export default [
  {
    path: '',
    component: GestionProcesosComponent,
    data: {
      title: 'navigation.gestionProcesos',
    },
  },
] as Routes;
