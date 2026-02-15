/**
 * Range to highlight inside text (keyword match from API)
 */
export interface AlertHighlightRange {
  start: number;
  end: number;
  text: string;
}

const MARK_OPEN = '<mark class="alert-highlight">';
const MARK_CLOSE = '</mark>';

/**
 * Escape HTML special characters to prevent XSS when building highlight HTML.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build HTML string for annotation text with highlighted ranges.
 * Ranges must be sorted by start; overlapping ranges are merged by taking the union.
 * Returns escaped text with <mark class="alert-highlight"> around keyword ranges.
 */
export function buildAnnotationWithHighlights(
  annotation: string | null | undefined,
  highlights: AlertHighlightRange[] | null | undefined,
  maxLength?: number
): string {
  if (annotation == null || annotation === '') {
    return '–';
  }
  const text = annotation;
  const truncated = maxLength && text.length > maxLength;
  const displayText = truncated ? text.slice(0, maxLength) + '…' : text;

  if (!highlights?.length) {
    return escapeHtml(displayText);
  }

  // Sort by start, then merge overlapping ranges
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const h of sorted) {
    const start = Math.max(0, h.start);
    const end = Math.min(displayText.length, h.end);
    if (start >= end) continue;
    const last = merged[merged.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      merged.push({ start, end });
    }
  }

  if (merged.length === 0) {
    return escapeHtml(displayText);
  }

  let out = '';
  let pos = 0;
  for (const { start, end } of merged) {
    if (start > pos) {
      out += escapeHtml(displayText.slice(pos, start));
    }
    out += MARK_OPEN + escapeHtml(displayText.slice(start, end)) + MARK_CLOSE;
    pos = end;
  }
  if (pos < displayText.length) {
    out += escapeHtml(displayText.slice(pos));
  }
  return out;
}
