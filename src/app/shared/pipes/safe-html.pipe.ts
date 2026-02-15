import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marks a string as safe HTML for binding to [innerHTML].
 * Only use with HTML produced by the app (e.g. buildAnnotationWithHighlights), never with raw user input.
 */
@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml | null {
    if (value == null || value === '') {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
