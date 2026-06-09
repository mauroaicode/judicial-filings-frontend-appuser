import { environment } from '@app/core/config/environment.config';
import type {
  VoiceTtsSynthesisCallbacks,
  VoiceTtsSynthesisSession,
} from './voice-tts.types';

const DEFAULT_SAMPLE_RATE = 24000;

export function startDeepgramTts(
  text: string,
  callbacks: VoiceTtsSynthesisCallbacks,
): VoiceTtsSynthesisSession {
  const controller = new AbortController();
  let cancelled = false;

  void synthesize(text, controller.signal, callbacks, () => cancelled);

  return {
    cancel: () => {
      cancelled = true;
      controller.abort();
    },
  };
}

async function synthesize(
  text: string,
  signal: AbortSignal,
  callbacks: VoiceTtsSynthesisCallbacks,
  isCancelled: () => boolean,
): Promise<void> {
  const { ttsUrl, model, apiKey } = environment.voice.deepgram;
  if (!apiKey) {
    callbacks.onError?.('NG_APP_DEEPGRAM_API_KEY no configurada');
    return;
  }

  const params = new URLSearchParams({
    model:       model,
    encoding:    'linear16',
    container:   'wav',
    sample_rate: String(DEFAULT_SAMPLE_RATE),
  });
  const url = `${ttsUrl}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      signal,
      headers: {
        Authorization:  `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (isCancelled()) return;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = (err as Record<string, unknown>)['err_msg']
        ?? (err as Record<string, unknown>)['message']
        ?? `HTTP ${res.status}`;
      callbacks.onError?.(String(detail));
      return;
    }

    const wavBytes = await res.arrayBuffer();
    if (isCancelled()) return;

    const pcm = extractPcm16FromWav(wavBytes);
    if (!pcm || pcm.byteLength === 0) {
      callbacks.onError?.('Respuesta TTS vacía o WAV inválido');
      return;
    }

    const durationS = pcm.byteLength / 2 / DEFAULT_SAMPLE_RATE;
    callbacks.onStart?.(DEFAULT_SAMPLE_RATE);
    callbacks.onPcmChunk?.(pcm);
    callbacks.onDone?.(durationS);
  } catch (err) {
    if (isCancelled() || (err as Error).name === 'AbortError') return;
    callbacks.onError?.((err as Error).message || 'Error Deepgram TTS');
  }
}

/**
 * Prefetch: dispara la petición HTTP a Deepgram y devuelve los bytes PCM16
 * ya extraídos del WAV, listos para reproducir.  Se usa para iniciar la
 * síntesis del `answer` mientras el audio del `wait` todavía suena.
 *
 * Retorna null si la API key no está configurada, el texto está vacío,
 * la red falla o la respuesta es inválida (el caller hace fallback a
 * startDeepgramTts en ese caso).
 */
export async function prefetchDeepgramPcm(text: string): Promise<ArrayBuffer | null> {
  const { ttsUrl, model, apiKey } = environment.voice.deepgram;
  if (!apiKey || !text.trim()) return null;

  const params = new URLSearchParams({
    model,
    encoding:    'linear16',
    container:   'wav',
    sample_rate: String(DEFAULT_SAMPLE_RATE),
  });

  try {
    const res = await fetch(`${ttsUrl}?${params.toString()}`, {
      method:  'POST',
      headers: {
        Authorization:  `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const wav = await res.arrayBuffer();
    return extractPcm16FromWav(wav);
  } catch {
    return null;
  }
}

/** Extrae PCM16 del chunk "data" de un WAV linear16 (mono). */
function extractPcm16FromWav(wav: ArrayBuffer): ArrayBuffer | null {
  const view = new DataView(wav);
  if (wav.byteLength < 44 || readAscii(view, 0, 4) !== 'RIFF') return null;

  let offset = 12;
  while (offset + 8 <= wav.byteLength) {
    const id   = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    offset += 8;
    if (id === 'data') {
      return wav.slice(offset, offset + size);
    }
    offset += size;
  }
  return null;
}

function readAscii(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}
