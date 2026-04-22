import { Routes } from '@angular/router';
import { ActuacionesRecientesComponent } from './actuaciones-recientes.component';

export default [
  {
    path: '',
    component: ActuacionesRecientesComponent,
    data: { title: 'actuacionesRecientes.title' }
  },
] as Routes;
