/**
 * Normalizes the backend QR payload for an <img src>.
 * The contract is a data URI. BaconQrCode may still return a raw SVG document.
 */
export function toQrImageSrc(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
    const bytes = new TextEncoder().encode(trimmed);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  }

  return trimmed;
}
