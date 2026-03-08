import { Routes } from '@angular/router';
import { KeywordsComponent } from './keywords.component';

export default [
    {
        path: '',
        component: KeywordsComponent,
        data: {
            title: 'navigation.keywords'
        }
    },
] as Routes;
