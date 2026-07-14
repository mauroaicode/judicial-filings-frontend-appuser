/**
 * Helpers for API datetime values (Laravel `Y-m-d H:i:s`, ISO-8601, etc.).
 */

const MONTHS_SHORT_ES = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MONTHS_SHORT_EN = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Extracts a usable datetime string from API payloads. */
export function coerceApiDateTimeInput(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const fromNumber = new Date(value);
        return Number.isNaN(fromNumber.getTime()) ? null : fromNumber.toISOString();
    }

    if (typeof value === 'object') {
        const maybeDate = value as { date?: unknown; datetime?: unknown };
        if (typeof maybeDate.date === 'string') {
            return maybeDate.date;
        }
        if (typeof maybeDate.datetime === 'string') {
            return maybeDate.datetime;
        }
        return null;
    }

    const raw = String(value).trim();
    return raw || null;
}

/** Converts API datetime to a Date usable for formatting. */
export function parseApiDateTime(value: unknown): Date | null {
    const raw = coerceApiDateTimeInput(value);
    if (!raw) {
        return null;
    }

    // ISO (e.g. 2028-07-15T14:30:00.000000Z)
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        const isoDate = new Date(raw);
        return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }

    // Laravel / API: 2028-07-15 14:30:00[.uuuuuu] or 2028-07-15
    const match = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/
    );

    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const hour = Number(match[4] ?? 0);
        const minute = Number(match[5] ?? 0);
        const second = Number(match[6] ?? 0);
        const parsed = new Date(year, month, day, hour, minute, second);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // dd/MM/yyyy[ HH:mm[:ss]]
    const slashMatch = raw.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (slashMatch) {
        const day = Number(slashMatch[1]);
        const month = Number(slashMatch[2]) - 1;
        const year = Number(slashMatch[3]);
        const hour = Number(slashMatch[4] ?? 0);
        const minute = Number(slashMatch[5] ?? 0);
        const second = Number(slashMatch[6] ?? 0);
        const parsed = new Date(year, month, day, hour, minute, second);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallback = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Formats API datetime for UI.
 * - Machine formats (`Y-m-d H:i:s`, ISO) → compact `15 Jul 2028 14:30`
 * - Already localized strings → shown as-is (never truncated)
 */
export function formatApiDateTimeDisplay(
    value: unknown,
    format: 'date' | 'datetime' = 'datetime',
    locale: 'es' | 'en' = 'es'
): string {
    const raw = coerceApiDateTimeInput(value);
    if (!raw) {
        return '';
    }

    // Backend sometimes returns an already-localized sentence (e.g. "Jueves, 17 de diciembre...").
    // Keep it intact; never slice for display.
    if (/[a-záéíóúñ]/i.test(raw) && !/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw;
    }

    const date = parseApiDateTime(raw);
    if (!date) {
        return raw.replace('T', ' ');
    }

    const day = date.getDate().toString().padStart(2, '0');
    const months = locale === 'en' ? MONTHS_SHORT_EN : MONTHS_SHORT_ES;
    const monthRaw = months[date.getMonth()];
    const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (format === 'date') {
        return `${day} ${month} ${year}`;
    }

    return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/** Formats a date+time for create/update payloads: `Y-m-d H:i:s`. */
export function formatApiDateTime(date: string, time?: string | null): string | null {
    if (!date) {
        return null;
    }

    const datePart = date.slice(0, 10);
    const timeMatch = (time || '00:00:00').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!timeMatch) {
        return `${datePart} 00:00:00`;
    }

    return `${datePart} ${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] ?? '00'}`;
}
