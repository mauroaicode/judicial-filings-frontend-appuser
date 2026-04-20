import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import { AuthService } from '@app/core/auth/auth.service';
import { AiChatSession } from '../../models/ai-chat/ai-chat-session.model';

/** A single SSE chunk from the AI stream */
export interface SseChunk {
  chunk?: string;
  done: boolean;
}

/** Callback handlers for the streaming connection */
export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone:  ()           => void;
  onError: (err: Error) => void;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private _http      = inject(HttpClient);
  private _auth      = inject(AuthService);
  private _baseUrl   = `${environment.apiBaseUrl}/ai-chats`;

  // ── REST ──────────────────────────────────────────────────────────

  /** GET  /ai-chats/process/{processId} */
  getSessionsByProcess(processId: string): Observable<AiChatSession[]> {
    return this._http.get<AiChatSession[]>(`${this._baseUrl}/process/${processId}`);
  }

  /** GET  /ai-chats/{chatId}/messages */
  getMessages(chatId: string): Observable<any[]> {
    return this._http.get<any[]>(`${this._baseUrl}/${chatId}/messages`);
  }

  // ── SSE Streaming ─────────────────────────────────────────────────

  /**
   * POST /ai-chats/{chatId}/messages
   *
   * Opens a native fetch() stream and calls the provided callbacks
   * as each SSE chunk arrives.
   */
  sendMessage(
    chatId: string,
    content: string,
    searchMode: string, // "agile" or "strategic"
    handlers: StreamHandlers,
  ): AbortController {
    const controller = new AbortController();
    const token      = this._auth.accessToken;

    const url = `${this._baseUrl}/${chatId}/messages`;

    fetch(url, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'text/event-stream',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ 
        content,
        search_mode: searchMode 
      }),
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
            handlers.onDone();
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
                const parsed: SseChunk = JSON.parse(raw);
                if (parsed.done) {
                  handlers.onDone();
                  reader.cancel();
                  return;
                }
                if (parsed.chunk) {
                  handlers.onChunk(parsed.chunk);
                }
              } catch {
                // Skip malformed lines silently
              }
            }
          }

          return read();
        });

      return read();
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        handlers.onError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return controller;
  }
}
