import { Routes } from '@angular/router';
import { TasksComponent } from './tasks.component';

export default [
    {
        path: '',
        component: TasksComponent,
        data: {
            title: 'tasks.title',
        },
    },
] as Routes;
