import { Routes } from '@angular/router';
import { DirectorioDespachosComponent } from './directorio-despachos.component';

export default [
  {
    path: '',
    component: DirectorioDespachosComponent,
    data: {
      title: 'courtDirectory.title',
    },
  },
] as Routes;
