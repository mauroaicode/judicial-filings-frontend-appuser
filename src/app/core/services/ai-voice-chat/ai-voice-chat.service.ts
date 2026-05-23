import { Injectable, inject } from '@angular/core';
import { environment } from '@app/core/config/environment.config';
import { AuthService } from '@app/core/auth/auth.service';

/** Metadata del primer evento SSE de voz */
export interface VoiceSseMeta {
  source?:              string;
  complexity?:          string;
  mode_used?:           string;
  wait_message?:        string;
  /** Segundos estimados hasta la respuesta (UI / feedback). */
  estimated_wait_sec?:  number;
}

/** Evento SSE de POST /ai-chats/{chatId}/voice */
export interface VoiceSseEvent {
  meta?:                  VoiceSseMeta;
  chunk?:                 string;
  done?:                  boolean;
  /** Mensaje intermedio mientras el RAG trabaja (medium/deep/advisory) */
  progress?:              string;
  /** Primer progress en t≈0; no repetir si ya sonó meta.wait_message */
  immediate?:             boolean;
  /** Respuesta completa limpia (solo en evento final voice) */
  answer?:                string;
  source?:                string;
  complexity?:            string;
  mode_used?:             string;
  user_message_id?:       string;
  assistant_message_id?:  string;
  /** true = despedida; el frontend cierra el modal tras reproducir answer */
  conversation_end?:      boolean;
}

export interface VoiceStreamHandlers {
  onMeta?:     (meta: VoiceSseMeta) => void;
  onProgress?: (message: string, event: VoiceSseEvent) => void;
  onChunk?:    (text: string, event: VoiceSseEvent) => void;
  onDone?:     (event: VoiceSseEvent) => void;
  onError?:    (err: Error) => void;
}

@Injectable({ providedIn: 'root' })
export class AiVoiceChatService {
  private _auth    = inject(AuthService);
  private _baseUrl = `${environment.apiBaseUrl}/ai-chats`;

  /**
   * POST /ai-chats/{chatId}/voice — SSE (mismo patrón que /stream).
   *
   * Secuencia típica (voice):
   * 1. meta { wait_message, estimated_wait_sec } → TTS al instante
   * 2. progress { immediate: true }              → TTS solo si no hubo wait en meta
   * 3. progress { … } en ~1.5s / 4s / 7.5s       → TTS de seguimiento
   * 4. done { answer, conversation_end? }      → TTS respuesta; si conversation_end, cerrar modal
   */
  streamVoiceMessage(
    chatId: string,
    content: string,
    handlers: VoiceStreamHandlers,
  ): AbortController {
    const controller = new AbortController();
    const token      = this._auth.accessToken;
    const url        = `${this._baseUrl}/${chatId}/voice`;

    fetch(url, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        if (!response.body) {
          throw new Error('ReadableStream not supported in this browser.');
        }

        const reader  = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let   buffer  = '';

        const read = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              handlers.onDone?.({ done: true });
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';

            for (const part of parts) {
              for (const line of part.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const raw = line.slice(5).trim();
                if (!raw) continue;

                try {
                  const parsed = JSON.parse(raw) as VoiceSseEvent;

                  if (parsed.meta) {
                    handlers.onMeta?.(parsed.meta);
                    continue;
                  }

                  if (parsed.done) {
                    handlers.onDone?.(parsed);
                    reader.cancel();
                    return;
                  }

                  if (parsed.progress) {
                    handlers.onProgress?.(parsed.progress, parsed);
                    continue;
                  }

                  if (parsed.chunk) {
                    handlers.onChunk?.(parsed.chunk, parsed);
                  }
                } catch {
                  /* ignore malformed SSE lines */
                }
              }
            }

            return read();
          });

        return read();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return controller;
  }
}
