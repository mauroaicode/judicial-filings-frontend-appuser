/** Colas repetidas típicas de alucinación Whisper (es/en). */
const REPEATED_TRAILING_GRATITUDE =
  /\s+(?:(?:¡+\s*)?(?:muchas\s+)?gracias\s*[.!¡]*\s*){2,}$/iu;

const REPEATED_TRAILING_THANKS =
  /\s+(?:(?:thank\s+(?:you|u)|thanks(?:\s+for\s+watching)?)\s*[.!?]*\s*){2,}$/iu;

const SUBTITLE_HALLUCINATION =
  /\s*(?:subt[ií]tulos\s+(?:realizados|hechos)\s+(?:por|de)[^.]*\.?\s*)+$/iu;

/**
 * Quita "¡Gracias!" u otras colas inventadas por STT al final del audio.
 */
export function cleanSttHallucinations(text: string): string {
  let cleaned = text.trim();

  cleaned = cleaned
    .replace(REPEATED_TRAILING_GRATITUDE, '')
    .replace(REPEATED_TRAILING_THANKS, '')
    .replace(SUBTITLE_HALLUCINATION, '')
    .trim();

  if (!/(?<=[,;])\s*gracias\s*\?/iu.test(cleaned)) {
    cleaned = cleaned
      .replace(/\?\s+(?:¡+\s*)?(?:muchas\s+)?gracias\s*[.!¡]*\s*$/iu, '?')
      .replace(/\.\s+(?:¡+\s*)?(?:muchas\s+)?gracias\s*[.!¡]*\s*$/iu, '.')
      .replace(/\s{2,}(?:¡+\s*)?(?:muchas\s+)?gracias\s*[.!¡]+\s*$/iu, '')
      .trim();
  }

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}
