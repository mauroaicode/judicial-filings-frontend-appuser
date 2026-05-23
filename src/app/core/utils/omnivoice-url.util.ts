/** Resolves a path-relative OmniVoice HTTP URL (e.g. `/ov/transcribe`) against the current origin. */
export function resolveOmnivoiceHttpUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}

/** Resolves a path-relative WebSocket URL (e.g. `/ov/ws/tts`) for the dev proxy. */
export function resolveOmnivoiceWsUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  if (typeof window === 'undefined') return url;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${url}`;
}
