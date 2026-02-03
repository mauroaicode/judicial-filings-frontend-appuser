import { Routes } from '@angular/router';
import { GestionProcesosComponent } from './gestion-procesos.component';
import { ProcessDetailComponent } from './pages/process-detail/process-detail.component';

export default [
  {
    path: '',
    component: GestionProcesosComponent,
    data: {
      title: 'navigation.gestionProcesos',
    },
  },
  {
    path: ':id',
    component: ProcessDetailComponent,
    data: {
      title: 'processDetail.title',
    },
  },
] as Routes;
