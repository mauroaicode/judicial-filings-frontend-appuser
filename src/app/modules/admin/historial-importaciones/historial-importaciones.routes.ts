import { Routes } from '@angular/router';
import { HistorialImportacionesComponent } from './historial-importaciones.component';

export default [
  {
    path: '',
    component: HistorialImportacionesComponent,
    data: { title: 'historialImportaciones.title' },
  },
] as Routes;
