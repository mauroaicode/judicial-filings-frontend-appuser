import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, provideAppInitializer, inject, isDevMode } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideMarkdown } from 'ngx-markdown';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { AVAILABLE_LANGUAGES } from './core/transloco/languages.constants';
import { TranslocoHttpLoader } from './core/transloco/transloco.http-loader';
import { ThemeService } from './core/services/theme/theme.service';
import { authInterceptor } from './core/interceptors/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    provideRouter(routes),
    
    // Transloco Config
    provideTransloco({
      config: {
        availableLangs: AVAILABLE_LANGUAGES,
        defaultLang: 'es',
        fallbackLang: 'es',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const translocoService = inject(TranslocoService);
      // Eagerly initialize theme so DaisyUI data-theme is set before first render.
      // ThemeService reads localStorage + system preference in its constructor.
      inject(ThemeService);

      const defaultLang = translocoService.getDefaultLang();
      translocoService.setActiveLang(defaultLang);
      
      return firstValueFrom(translocoService.load(defaultLang)).catch(() => undefined);
    }),

    provideMarkdown(),
  ]
};
