import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { formatApiDateTimeDisplay } from '@app/core/utils/api-datetime.util';

/**
 * Formats API datetime (`Y-m-d H:i:s`, ISO, etc.) for display.
 *
 * @example
 * {{ task.due_date | apiDateTime }}
 * {{ task.due_date | apiDateTime:'date' }}
 */
@Pipe({
  name: 'apiDateTime',
  standalone: true,
})
export class ApiDateTimePipe implements PipeTransform {
  private _transloco = inject(TranslocoService, { optional: true });

  transform(value: unknown, format: 'date' | 'datetime' = 'datetime'): string {
    const lang = this._transloco?.getActiveLang()?.startsWith('en') ? 'en' : 'es';
    return formatApiDateTimeDisplay(value, format, lang);
  }
}
