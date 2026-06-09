/**
 * Divide texto largo en frases cortas (~160 chars) para síntesis TTS.
 *
 * Beneficio: la primera frase se sintetiza ~2-3× más rápido que el texto completo
 * y puede reproducirse mientras las siguientes se prefetchean en paralelo.
 *
 * Orden de preferencia para el punto de corte:
 *   1. Punto/exclamación/interrogación dentro del rango [MIN_CHARS, maxChars]
 *   2. Coma/punto y coma/dos puntos
 *   3. Último espacio dentro de maxChars
 *   4. Corte duro en maxChars
 */

const MIN_CHARS = 40;

export function splitIntoTtsSentences(text: string, maxChars = 160): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxChars) {
    let cutAt = -1;

    // 1. Sentence-ending punctuation: ., !, ?, …  (incluye ¿ y ¡ para español)
    const sentenceRe = /[.!?…]+(?:\s|$)/g;
    let m: RegExpExecArray | null;
    while ((m = sentenceRe.exec(remaining)) !== null) {
      const end = m.index + m[0].length;
      if (end >= MIN_CHARS && end <= maxChars) cutAt = end;
      else if (end > maxChars) break;
    }

    // 2. Comma / semicolon / colon
    if (cutAt === -1) {
      const commaRe = /[,;:]\s*/g;
      while ((m = commaRe.exec(remaining)) !== null) {
        const end = m.index + m[0].length;
        if (end >= MIN_CHARS && end <= maxChars) cutAt = end;
        else if (end > maxChars) break;
      }
    }

    // 3. Last whitespace within maxChars
    if (cutAt === -1) {
      const sub = remaining.slice(0, maxChars);
      const lastSpace = sub.lastIndexOf(' ');
      cutAt = lastSpace >= MIN_CHARS ? lastSpace + 1 : maxChars;
    }

    const chunk = remaining.slice(0, cutAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(cutAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}
