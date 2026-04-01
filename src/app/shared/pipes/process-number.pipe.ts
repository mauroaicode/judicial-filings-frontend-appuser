import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'processNumber',
  standalone: true
})
export class ProcessNumberPipe implements PipeTransform {
  /**
   * Formats a 23-digit judicial process number into the standard Colombia format:
   * XX-XXX-XX-XX-XXX-YYYY-XXXXX-ZZ
   * Example: 76001333301020190007300 -> 76-001-33-33-010-2019-00073-00
   * 
   * @param value The 23-digit process number
   * @returns Formatted process number
   */
  transform(value: string | number | null | undefined): string {
    if (!value) return '';
    
    // Ensure string and clean non-numeric characters
    const clean = value.toString().replace(/[^0-9]/g, '');
    
    // Only format if it has exactly 23 digits
    if (clean.length !== 23) {
      return value.toString();
    }

    // Split parts: 2-3-2-2-3-4-5-2
    const parts = [
      clean.substring(0, 2),    // Depto
      clean.substring(2, 5),    // Mun
      clean.substring(5, 7),    // Corp
      clean.substring(7, 9),    // Desp
      clean.substring(9, 12),   // Juz/Sec
      clean.substring(12, 16),  // Año
      clean.substring(16, 21),  // Consec
      clean.substring(21, 23)   // Rec
    ];

    return parts.join('-');
  }
}
