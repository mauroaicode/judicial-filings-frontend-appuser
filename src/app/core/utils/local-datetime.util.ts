/** Local calendar helpers for due-date / due-time UI constraints. */

/** Today as `Y-m-d` in the browser local timezone. */
export function formatLocalDateYmd(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Time as `HH:mm` in local timezone. */
export function formatLocalTimeHhMm(date: Date = new Date()): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
}

/** Minutes since midnight for `HH:mm`. */
export function timeToMinutes(hhmm: string): number | null {
    const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
        return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
        return null;
    }
    return hours * 60 + minutes;
}

/**
 * Next 5-minute slot strictly after `now` (picker uses 5-min increments).
 * Returns `HH:mm`, or `null` if no slot remains today.
 */
export function nextFiveMinuteSlot(now: Date = new Date()): string | null {
    const current = now.getHours() * 60 + now.getMinutes();
    const next = Math.ceil((current + 1) / 5) * 5;
    if (next >= 24 * 60) {
        return null;
    }
    const hours = Math.floor(next / 60);
    const minutes = next % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function isLocalDateBeforeToday(ymd: string, now: Date = new Date()): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        return false;
    }
    return ymd < formatLocalDateYmd(now);
}

export function isLocalDateToday(ymd: string, now: Date = new Date()): boolean {
    return ymd === formatLocalDateYmd(now);
}

/** True when date+time is already in the past (or equal to now). */
export function isLocalDateTimeInPast(
    ymd: string,
    hhmm: string,
    now: Date = new Date()
): boolean {
    if (isLocalDateBeforeToday(ymd, now)) {
        return true;
    }
    if (!isLocalDateToday(ymd, now)) {
        return false;
    }
    const selected = timeToMinutes(hhmm);
    if (selected === null) {
        return false;
    }
    const current = now.getHours() * 60 + now.getMinutes();
    return selected <= current;
}
