import { environment } from '@app/core/config/environment.config';
import { resolveOmnivoiceWsUrl } from '@app/core/utils/omnivoice-url.util';
import type {
  VoiceTtsSynthesisCallbacks,
  VoiceTtsSynthesisSession,
} from './voice-tts.types';

export function startOmnivoiceTts(
  text: string,
  callbacks: VoiceTtsSynthesisCallbacks,
): VoiceTtsSynthesisSession {
  const wsUrl = resolveOmnivoiceWsUrl(environment.voice.omnivoice.ttsWsUrl);
  let ws: WebSocket | null = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';
  let cancelled = false;

  const finish = (): void => {
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    ws.close();
    ws = null;
  };

  ws.onopen = () => {
    if (cancelled || !ws) return;
    ws.send(JSON.stringify({
      text,
      voice:     environment.voice.omnivoice.ttsVoiceId,
      language:  'Spanish',
      emo_alpha: 1.0,
    }));
  };

  ws.onmessage = (ev) => {
    if (cancelled) return;
    if (typeof ev.data === 'string') {
      try {
        handleJson(JSON.parse(ev.data) as Record<string, unknown>, callbacks);
      } catch { /* ignore */ }
    } else if (ev.data instanceof ArrayBuffer) {
      callbacks.onPcmChunk?.(ev.data.slice(0));
    }
  };

  ws.onerror = () => {
    if (cancelled) return;
    finish();
    callbacks.onError?.('Error en el servicio de voz OmniVoice.');
  };

  ws.onclose = () => { /* RunPod suele dejar el WS abierto; el componente lo cierra tras done */ };

  return {
    cancel: () => {
      cancelled = true;
      finish();
    },
  };
}

function handleJson(
  msg: Record<string, unknown>,
  callbacks: VoiceTtsSynthesisCallbacks,
): void {
  switch (msg['type']) {
    case 'start':
      callbacks.onStart?.((msg['sample_rate'] as number) || 24000);
      break;
    case 'done':
      callbacks.onDone?.(msg['duration_s'] as number | undefined);
      break;
    case 'error':
      callbacks.onError?.(String(msg['detail'] || 'desconocido'));
      break;
  }
}
