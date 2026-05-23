/**
 * Voice assistant with automatic VAD (Voice Activity Detection).
 *
 * State machine:
 *   idle → (tap) → standby [mic open, VAD loop running, waiting for speech]
 *   standby → (speech detected) → listening [MediaRecorder capturing]
 *   listening → (silence 1.5 s) → transcribing [POST /transcribe]
 *   transcribing → thinking [POST /ai-chats/{id}/voice SSE]
 *   thinking → speaking [TTS buffer único por frase; voz wait + answer]
 *   speaking → standby [auto-cycle] o cierre si conversation_end / 10s sin voz
 *
 * Tap while standby/listening → deactivate → idle.
 * conversation_end (SSE) → TTS despedida → cerrar modal.
 * 10 s en standby sin hablar → cerrar modal.
 *
 * VAD: RMS energy via AnalyserNode + requestAnimationFrame loop.
 * No external packages required.
 */
import {
  Component, Input, Output, EventEmitter,
  signal, OnDestroy, OnInit,
  ChangeDetectionStrategy, inject, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '@app/core/config/environment.config';
import {
  resolveOmnivoiceHttpUrl,
  resolveOmnivoiceWsUrl,
} from '@app/core/utils/omnivoice-url.util';
import { AiVoiceChatService } from 'src/app/core/services/ai-voice-chat/ai-voice-chat.service';

export type VoiceState =
  | 'idle'
  | 'standby'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

@Component({
  selector: 'app-voice-assistant-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-assistant-modal.component.html',
  styleUrls: ['./voice-assistant-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceAssistantModalComponent implements OnInit, OnDestroy {
  @Input() chatId: string | null = null;

  @Output() closed        = new EventEmitter<void>();
  @Output() turnCompleted = new EventEmitter<{ userMsgId: string; assistantMsgId: string }>();

  private _cdr          = inject(ChangeDetectorRef);
  private _voiceService = inject(AiVoiceChatService);

  // ── UI signals ────────────────────────────────────────────────
  state        = signal<VoiceState>('idle');
  statusText   = signal('Iniciando...');
  lastUserText      = signal('');
  assistantPreview  = signal(''); // chunks SSE solo para UI, sin TTS
  errorMessage = signal('');
  lastDuration = signal('');
  hasNoChatId  = signal(false);

  readonly waveformBars = Array.from({ length: 20 }, (_, i) => i);

  // ── AudioContext (unlocked via user gesture) ──────────────────
  private audioCtx:        AudioContext | null       = null;
  private ttsSampleRate                              = 24000;
  /**
   * TTS: un solo AudioBuffer por frase (sin reproducir cada chunk WS por separado).
   * Evita el ritmo "pa/ta/pa" del streaming; se esperan todos los PCM + cola final.
   */
  private ttsNextPlayTime          = 0;
  private ttsPcmBuffers:           ArrayBuffer[] = [];
  private ttsWsDoneReceived        = false;
  private ttsWsClosed              = false;
  private ttsExpectedDurationS     = 0;
  private ttsLastBufferedSamples   = 0;
  private ttsPhrasePlaybackStarted = false;
  private ttsFinalizeAttempts      = 0;
  private ttsPlayTimer:             ReturnType<typeof setTimeout> | null = null;
  private gapBeforePhrasePlay      = false;
  private ttsPhrasesPlayed           = 0;
  private lastTtsSource:            AudioBufferSourceNode | null = null;
  private ttsSessionComplete:       (() => void) | null = null;
  private ttsGain:                  GainNode | null = null;

  /** Debounce tras JSON "done" para PCM tardíos (el WS de RunPod casi nunca se cierra solo). */
  private static readonly TTS_TAIL_FLUSH_MS       = 160;
  private static readonly TTS_TAIL_MAX_ATTEMPTS   = 4;
  private static readonly TTS_DURATION_FILL_RATIO = 0.97;
  private static readonly TTS_PHRASE_GAP_SEC        = 0.35;
  private static readonly TTS_POST_PHRASE_PAUSE_MS = 300;
  /** Progress en pantalla; voz solo en wait + answer (menos espera total). */
  private static readonly TTS_SPEAK_PROGRESS_AUDIO = false;

  // ── TTS WebSocket + cola (wait_message → respuesta) ───────────
  private wsTTS: WebSocket | null = null;
  private ttsQueue: string[] = [];
  private ttsBusy  = false;
  private ttsOnQueueEmpty: (() => void) | null = null;

  // ── SSE voz (Laravel) ─────────────────────────────────────────
  private voiceStreamAbort: AbortController | null = null;
  /** Evita doble TTS: meta.wait_message y progress immediate suelen ser el mismo texto. */
  private waitPlayed = false;
  /** Cerrar modal tras reproducir la respuesta final (despedida del cerebro). */
  private pendingConversationEnd = false;

  // ── Microphone & VAD ─────────────────────────────────────────
  private mediaStream:    MediaStream | null   = null;
  private mediaRecorder:  MediaRecorder | null = null;
  private recordedChunks: Blob[]               = [];

  private isVadActive  = false;
  private vadSpeaking  = false;
  private silenceTimer:  ReturnType<typeof setTimeout> | null = null;
  private standbyTimer:  ReturnType<typeof setTimeout> | null = null;
  private vadAnalyser:   AnalyserNode | null  = null;
  private vadRafData:    Float32Array<ArrayBuffer> | null  = null;
  private vadRafId:      number | null        = null;

  /** RMS threshold to consider "speech". Tune if too sensitive / not sensitive enough. */
  private readonly VAD_THRESHOLD       = 0.012;
  /** ms of continuous silence before auto-stopping the recording. */
  private readonly SILENCE_DURATION_MS = 1500;
  /** ms en standby sin hablar antes de cerrar el asistente. */
  private readonly STANDBY_SILENCE_MS = 10_000;

  private get sttHttpUrl(): string {
    return resolveOmnivoiceHttpUrl(environment.omnivoice.transcribeUrl);
  }

  private get ttsWsUrl(): string {
    return resolveOmnivoiceWsUrl(environment.omnivoice.ttsWsUrl);
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    if (!this.chatId) {
      this.hasNoChatId.set(true);
      this.state.set('error');
      this.errorMessage.set('No hay una sesión de chat activa. Abre o crea un chat de texto primero.');
      this._cdr.markForCheck();
      return;
    }
    this.state.set('idle');
    this.statusText.set('Toca para activar el asistente');
    this._cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.clearTtsPlayTimer();
    this.voiceStreamAbort?.abort();
    this.deactivateVad(false);
    this.closeTtsWs();
    this.closeAudioCtx();
  }

  // ═══════════════════════════════════════════════════════════════
  // ORB TAP
  // ═══════════════════════════════════════════════════════════════
  onOrbClick(): void {
    const s = this.state();
    if (s === 'error' && this.hasNoChatId()) return;
    if (s === 'idle' || s === 'error') {
      this.activateVad();
    } else if (s === 'standby' || s === 'listening') {
      this.deactivateVad(true);
    }
    // transcribing / thinking / speaking → orb disabled, no action
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIVATION
  // ═══════════════════════════════════════════════════════════════
  private activateVad(): void {
    // AudioContext MUST be created inside a user gesture to stay unlocked.
    // sampleRate: 24000 matches TTS output — avoids inter-chunk resampling artifacts.
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContext({ sampleRate: 24000 });
    }
    this.audioCtx.resume().catch(() => { /* ignore */ });

    this.state.set('standby');
    this.statusText.set('Solicitando micrófono...');
    this.lastUserText.set('');
    this.errorMessage.set('');
    this._cdr.markForCheck();

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        this.mediaStream = stream;

        // Connect stream to analyser (shares the same AudioContext as TTS)
        const src = this.audioCtx!.createMediaStreamSource(stream);
        this.vadAnalyser         = this.audioCtx!.createAnalyser();
        this.vadAnalyser.fftSize = 512;
        src.connect(this.vadAnalyser);
        this.vadRafData = new Float32Array(this.vadAnalyser.fftSize);

        this.isVadActive = true;
        this.vadSpeaking = false;
        this.startVadLoop();
        this.startStandbyTimer();

        console.log('[VAD] ✅ Micrófono abierto — VAD activo');
        this.statusText.set('Te escucho... habla cuando quieras');
        this._cdr.markForCheck();
      })
      .catch(err => {
        console.error('[VAD] getUserMedia error:', err);
        this.setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
      });
  }

  private deactivateVad(goToIdle: boolean): void {
    this.isVadActive = false;
    this.vadSpeaking = false;

    if (this.silenceTimer !== null) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    if (this.standbyTimer !== null) { clearTimeout(this.standbyTimer); this.standbyTimer = null; }
    if (this.vadRafId !== null) {
      cancelAnimationFrame(this.vadRafId);
      this.vadRafId = null;
    }

    this.mediaRecorder?.stop();
    this.mediaRecorder = null;
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream    = null;
    this.recordedChunks = [];
    this.vadAnalyser    = null;
    this.vadRafData     = null;

    if (goToIdle) {
      this.state.set('idle');
      this.statusText.set('Toca para activar el asistente');
      this._cdr.markForCheck();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // VAD LOOP — requestAnimationFrame RMS analysis
  // ═══════════════════════════════════════════════════════════════
  private startVadLoop(): void {
    const loop = () => {
      if (!this.isVadActive) return;

      this.vadAnalyser!.getFloatTimeDomainData(this.vadRafData!);

      let sum = 0;
      for (let i = 0; i < this.vadRafData!.length; i++) {
        sum += this.vadRafData![i] * this.vadRafData![i];
      }
      const rms = Math.sqrt(sum / this.vadRafData!.length);

      // Ignore VAD triggers while processing the current turn
      const busy = this.state() === 'transcribing'
        || this.state() === 'thinking'
        || this.state() === 'speaking';

      if (!busy) {
        if (rms > this.VAD_THRESHOLD) {
          if (!this.vadSpeaking) this.onVadSpeechStart();
          // Reset silence timer on any new speech energy
          if (this.silenceTimer !== null) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else if (this.vadSpeaking && this.silenceTimer === null) {
          // Start silence countdown
          this.silenceTimer = setTimeout(() => {
            this.silenceTimer = null;
            if (this.vadSpeaking) this.onVadSpeechEnd();
          }, this.SILENCE_DURATION_MS);
        }
      }

      this.vadRafId = requestAnimationFrame(loop);
    };

    this.vadRafId = requestAnimationFrame(loop);
  }

  private onVadSpeechStart(): void {
    if (this.state() !== 'standby' || !this.mediaStream) return;
    // User spoke — reset the inactivity timer
    if (this.standbyTimer !== null) { clearTimeout(this.standbyTimer); this.standbyTimer = null; }
    this.vadSpeaking    = true;
    this.recordedChunks = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop  = () => this.transcribeRecording();
    this.mediaRecorder.onerror = (e) => {
      console.error('[MediaRecorder] Error:', e);
      this.setError('Error en el micrófono.');
    };
    this.mediaRecorder.start(250);

    console.log('[VAD] 🎙️ Habla detectada — grabando');
    this.state.set('listening');
    this.statusText.set('Escuchando...');
    this._cdr.markForCheck();
  }

  private onVadSpeechEnd(): void {
    this.vadSpeaking = false;
    console.log('[VAD] 🔇 Silencio detectado — deteniendo grabación');
    this.mediaRecorder?.stop();
    this.mediaRecorder = null;

    this.state.set('transcribing');
    this.statusText.set('Transcribiendo...');
    this._cdr.markForCheck();
  }

  // ═══════════════════════════════════════════════════════════════
  // STT — HTTP POST /transcribe
  // ═══════════════════════════════════════════════════════════════
  private transcribeRecording(): void {
    if (this.recordedChunks.length === 0) {
      console.warn('[STT] No hay audio grabado');
      this.resumeStandby();
      return;
    }

    const mimeType  = this.recordedChunks[0].type || 'audio/webm';
    const audioBlob = new Blob(this.recordedChunks, { type: mimeType });
    this.recordedChunks = [];

    console.log(`[STT] POST ${this.sttHttpUrl} — ${audioBlob.size} bytes`);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'utterance.webm');
    formData.append('mode', 'fast');

    fetch(this.sttHttpUrl, { method: 'POST', body: formData })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as Record<string, string>)['detail'] ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ text: string }>;
      })
      .then(data => {
        const text = (data.text ?? '').trim();
        console.log('[STT] ✅ Transcripción:', text);

        if (!text) {
          console.warn('[STT] Transcripción vacía — resumiendo standby');
          this.resumeStandby();
          return;
        }

        this.lastUserText.set(text);
        this.sendToLaravel(text);
      })
      .catch(err => {
        console.error('[STT] Error:', err);
        this.setError(`Error de transcripción: ${(err as Error).message}`);
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // LARAVEL — POST /ai-chats/{chatId}/voice (SSE)
  // ═══════════════════════════════════════════════════════════════
  private sendToLaravel(content: string): void {
    if (!this.chatId) { this.setError('Sin sesión de chat activa.'); return; }

    this.voiceStreamAbort?.abort();
    this.assistantPreview.set('');
    this.ttsQueue         = [];
    this.ttsBusy          = false;
    this.ttsOnQueueEmpty    = null;
    this.waitPlayed             = false;
    this.pendingConversationEnd = false;
    this.ttsPhrasesPlayed       = 0;

    if (this.standbyTimer !== null) {
      clearTimeout(this.standbyTimer);
      this.standbyTimer = null;
    }

    this.state.set('thinking');
    this.statusText.set('Lexa está pensando...');
    this._cdr.markForCheck();

    console.log('[Voice] SSE /ai-chats/' + this.chatId + '/voice →', content);

    this.voiceStreamAbort = this._voiceService.streamVoiceMessage(this.chatId, content, {
      onMeta: meta => {
        const wait = (meta.wait_message ?? '').trim();
        if (!wait) return;

        this.waitPlayed = true;
        const eta = meta.estimated_wait_sec;
        console.log('[Voice] wait_message:', wait, eta != null ? `(~${eta}s)` : '');
        this.statusText.set(eta != null ? `${wait} (~${eta}s)` : wait);
        this._cdr.markForCheck();
        this.queueTts(wait);
      },

      onProgress: (message, event) => {
        if (event.source && event.source !== 'voice') return;
        const text = message.trim();
        if (!text) return;

        if (event.immediate) {
          if (this.waitPlayed) {
            console.log('[Voice] progress immediate omitido (ya sonó wait_message)');
            return;
          }
          this.waitPlayed = true;
          console.log('[Voice] progress immediate:', text);
        } else {
          console.log('[Voice] progress:', text);
        }

        this.statusText.set(text);
        this._cdr.markForCheck();
        if (VoiceAssistantModalComponent.TTS_SPEAK_PROGRESS_AUDIO) {
          this.queueTts(text);
        }
      },

      onChunk: (chunk, event) => {
        // Voice: no TTS por chunk (por seguridad si el backend envía alguno)
        if (event.source === 'voice') {
          this.assistantPreview.update(p => p + chunk);
          this._cdr.markForCheck();
          return;
        }
        console.log('[Voice] chunk ignorado (no voice):', chunk.length);
      },

      onDone: event => {
        console.log('[Voice] SSE done', event);
        this.voiceStreamAbort = null;

        if (event.user_message_id && event.assistant_message_id) {
          this.turnCompleted.emit({
            userMsgId:      event.user_message_id,
            assistantMsgId: event.assistant_message_id,
          });
        } else {
          this.turnCompleted.emit({ userMsgId: '', assistantMsgId: '' });
        }

        if (event.source && event.source !== 'voice') {
          if (!this.ttsBusy && this.ttsQueue.length === 0) this.resumeStandby();
          else this.ttsOnQueueEmpty = () => this.resumeStandby();
          return;
        }

        const conversationEnd = event.conversation_end === true;
        if (conversationEnd) {
          this.pendingConversationEnd = true;
          console.log('[Voice] conversation_end — cerrar tras despedida');
        }

        const answer = (event.answer ?? '').trim();
        this.assistantPreview.set('');
        const afterAnswer = () => {
          if (this.pendingConversationEnd) {
            this.completeConversationEnd();
          } else {
            this.resumeStandby();
          }
        };

        if (answer) {
          this.queueTts(answer, afterAnswer);
        } else if (conversationEnd) {
          this.completeConversationEnd();
        } else if (!this.ttsBusy && this.ttsQueue.length === 0) {
          this.resumeStandby();
        } else {
          this.ttsOnQueueEmpty = afterAnswer;
        }
      },

      onError: err => {
        console.error('[Voice] Error SSE:', err);
        this.voiceStreamAbort = null;
        this.setError('Error al obtener la respuesta de Lexa.');
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TTS — cola secuencial (wait → progress… → answer)
  // ═══════════════════════════════════════════════════════════════
  private queueTts(text: string, onAfter?: () => void): void {
    const trimmed = text.trim();
    if (!trimmed) {
      onAfter?.();
      return;
    }
    this.ttsQueue.push(trimmed);
    if (onAfter) {
      const prev = this.ttsOnQueueEmpty;
      this.ttsOnQueueEmpty = () => { prev?.(); onAfter(); };
    }
    this.processTtsQueue();
  }

  private processTtsQueue(): void {
    if (this.ttsBusy || this.ttsQueue.length === 0) return;
    this.ttsBusy = true;
    const text      = this.ttsQueue.shift()!;
    const gapBefore = this.ttsPhrasesPlayed > 0;
    this.ttsPhrasesPlayed++;
    this.runTtsSession(text, () => {
      this.ttsBusy = false;
      if (this.ttsQueue.length > 0) {
        this.processTtsQueue();
      } else {
        this.ttsOnQueueEmpty?.();
        this.ttsOnQueueEmpty = null;
      }
    }, gapBefore);
  }

  private ensureTtsGain(): GainNode {
    if (!this.audioCtx) throw new Error('AudioContext no inicializado');
    if (!this.ttsGain) {
      this.ttsGain = this.audioCtx.createGain();
      this.ttsGain.connect(this.audioCtx.destination);
    }
    return this.ttsGain;
  }

  private runTtsSession(text: string, onComplete: () => void, gapBefore = false): void {
    if (!this.audioCtx) {
      onComplete();
      return;
    }
    if (this.wsTTS) {
      console.warn('[TTS] Cerrando WS de sesión anterior (no debía seguir abierto)');
      this.closeTtsWs();
    }

    this.clearTtsPlayTimer();
    this.ttsPcmBuffers             = [];
    this.ttsWsDoneReceived         = false;
    this.ttsWsClosed               = false;
    this.ttsExpectedDurationS      = 0;
    this.ttsLastBufferedSamples    = 0;
    this.ttsPhrasePlaybackStarted  = false;
    this.ttsFinalizeAttempts       = 0;
    this.gapBeforePhrasePlay       = gapBefore;
    this.lastTtsSource             = null;
    this.ttsSessionComplete        = onComplete;

    console.log('[TTS] Conectando...', text.slice(0, 80));

    let chunkCount = 0;
    this.wsTTS = new WebSocket(this.ttsWsUrl);
    this.wsTTS.binaryType = 'arraybuffer';

    this.wsTTS.onopen = () => {
      console.log('[TTS] ✅ Conectado, enviando texto');
      this.wsTTS!.send(JSON.stringify({
        text,
        voice:     environment.omnivoice.ttsVoiceId,
        language:  'Spanish',
        emo_alpha: 1.0,
      }));
    };

    this.wsTTS.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          this.handleTtsJson(JSON.parse(ev.data));
        } catch { /* ignore */ }
      } else if (ev.data instanceof ArrayBuffer) {
        chunkCount++;
        console.log(`[TTS] Chunk #${chunkCount} — ${ev.data.byteLength} bytes (buffered)`);
        this.ttsPcmBuffers.push(ev.data.slice(0));
        if (this.ttsWsDoneReceived && !this.ttsPhrasePlaybackStarted) {
          this.schedulePhrasePlayback();
        }
      }
    };

    this.wsTTS.onerror = () => {
      this.clearTtsPlayTimer();
      this.ttsPcmBuffers = [];
      this.ttsWsClosed   = true;
      this.finishTtsSession();
      this.setError('Error en el servicio de voz.');
    };
    this.wsTTS.onclose = () => {
      console.log('[TTS] WS cerrado');
      this.ttsWsClosed = true;
    };
  }

  private ttsBufferedSamples(): number {
    return this.ttsPcmBuffers.reduce((s, b) => s + b.byteLength, 0) / 2;
  }

  private clearTtsPlayTimer(): void {
    if (this.ttsPlayTimer !== null) {
      clearTimeout(this.ttsPlayTimer);
      this.ttsPlayTimer = null;
    }
  }

  /** Tras JSON "done": breve debounce por PCM tardíos; no esperar cierre WS del servidor. */
  private schedulePhrasePlayback(): void {
    if (this.ttsPhrasePlaybackStarted) return;
    this.clearTtsPlayTimer();
    this.ttsPlayTimer = setTimeout(
      () => this.tryPlayBufferedPhrase(),
      VoiceAssistantModalComponent.TTS_TAIL_FLUSH_MS,
    );
  }

  private tryPlayBufferedPhrase(): void {
    this.ttsPlayTimer = null;
    if (this.ttsPhrasePlaybackStarted || !this.ttsWsDoneReceived) return;

    const buffered = this.ttsBufferedSamples();
    const expected = Math.floor(this.ttsExpectedDurationS * this.ttsSampleRate);
    const grew     = buffered > this.ttsLastBufferedSamples;
    this.ttsLastBufferedSamples = buffered;

    const durationOk = expected <= 0
      || buffered >= expected * VoiceAssistantModalComponent.TTS_DURATION_FILL_RATIO;

    if (grew && this.ttsFinalizeAttempts < VoiceAssistantModalComponent.TTS_TAIL_MAX_ATTEMPTS) {
      this.ttsFinalizeAttempts++;
      console.log(`[TTS] Buffer creciendo (${buffered} samples, #${this.ttsFinalizeAttempts})`);
      this.schedulePhrasePlayback();
      return;
    }

    if (
      !durationOk
      && this.ttsFinalizeAttempts < VoiceAssistantModalComponent.TTS_TAIL_MAX_ATTEMPTS
    ) {
      this.ttsFinalizeAttempts++;
      console.log(`[TTS] Esperando PCM (${buffered}/${expected}, #${this.ttsFinalizeAttempts})`);
      this.schedulePhrasePlayback();
      return;
    }

    if (this.ttsPcmBuffers.length === 0) {
      console.warn('[TTS] Sin audio en buffer');
      this.closeTtsWsIfOpen();
      this.finishTtsSession();
      return;
    }

    this.ttsPhrasePlaybackStarted = true;
    this.closeTtsWsIfOpen();
    console.log(
      `[TTS] ▶ Play — ${(buffered / this.ttsSampleRate).toFixed(2)}s, ${this.ttsPcmBuffers.length} chunks`,
    );
    this.playBufferedPhrase();
  }

  /** RunPod suele dejar el WS abierto; lo cerramos nosotros para no bloquear la cola. */
  private closeTtsWsIfOpen(): void {
    if (!this.wsTTS) return;
    const open = this.wsTTS.readyState === WebSocket.OPEN
      || this.wsTTS.readyState === WebSocket.CONNECTING;
    if (open) this.closeTtsWs();
  }

  /** Un único buffer por frase — sin cortes entre chunks WS. */
  private playBufferedPhrase(): void {
    if (!this.audioCtx) {
      this.finishTtsSession();
      return;
    }

    const totalSamples = this.ttsBufferedSamples();
    const float32      = new Float32Array(totalSamples);
    let offset = 0;

    for (const buf of this.ttsPcmBuffers) {
      const int16 = new Int16Array(buf);
      for (let i = 0; i < int16.length; i++) {
        float32[offset++] = int16[i] / 32768;
      }
    }
    this.ttsPcmBuffers = [];

    const fadeIn = Math.min(64, Math.max(1, Math.floor(float32.length * 0.004)));
    for (let i = 0; i < fadeIn; i++) float32[i] *= i / fadeIn;
    // Sin fade-out al final: en frases cortas (wait_message) comía la última sílaba.

    const audioBuffer = this.audioCtx.createBuffer(1, float32.length, this.ttsSampleRate);
    audioBuffer.getChannelData(0).set(float32);

    const now = this.audioCtx.currentTime;
    if (this.gapBeforePhrasePlay) {
      this.ttsNextPlayTime = Math.max(this.ttsNextPlayTime, now) + VoiceAssistantModalComponent.TTS_PHRASE_GAP_SEC;
      this.gapBeforePhrasePlay = false;
    } else if (this.ttsNextPlayTime < now + 0.02) {
      this.ttsNextPlayTime = now + 0.05;
    }

    this.state.set('speaking');
    this.statusText.set('Lexa está hablando...');
    this._cdr.markForCheck();

    const gain = this.ensureTtsGain();
    gain.gain.setValueAtTime(1, this.ttsNextPlayTime);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);
    source.onended = () => {
      console.log('[TTS] ✅ Frase reproducida (buffer único)');
      this.lastTtsSource = null;
      setTimeout(() => this.finishTtsSession(), VoiceAssistantModalComponent.TTS_POST_PHRASE_PAUSE_MS);
    };
    this.lastTtsSource = source;
    source.start(this.ttsNextPlayTime);
    this.ttsNextPlayTime += audioBuffer.duration;

  }

  private finishTtsSession(): void {
    this.clearTtsPlayTimer();
    const done = this.ttsSessionComplete;
    this.ttsSessionComplete = null;
    this.closeTtsWsIfOpen();
    done?.();
  }

  private handleTtsJson(msg: Record<string, unknown>): void {
    console.log('[TTS] JSON:', msg['type']);
    switch (msg['type']) {
      case 'start':
        this.ttsSampleRate = (msg['sample_rate'] as number) || 24000;
        this.statusText.set('Lexa está preparando la respuesta...');
        this._cdr.markForCheck();
        break;

      case 'done': {
        const durS = msg['duration_s'] as number | undefined;
        if (durS) {
          this.ttsExpectedDurationS = durS;
          this.lastDuration.set(`${durS.toFixed(1)}s`);
        }
        console.log(`[TTS] DONE — chunks: ${this.ttsPcmBuffers.length}, samples: ${this.ttsBufferedSamples()}, dur: ${durS}s`);
        this.ttsWsDoneReceived = true;
        this.schedulePhrasePlayback();
        break;
      }

      case 'error':
        this.clearTtsPlayTimer();
        this.ttsPcmBuffers = [];
        this.finishTtsSession();
        this.setError(`Error TTS: ${msg['detail'] || 'desconocido'}`);
        break;
    }
  }

  /** Despedida del cerebro: deja de escuchar y cierra el modal. */
  private completeConversationEnd(): void {
    this.pendingConversationEnd = false;
    this.voiceStreamAbort?.abort();
    this.voiceStreamAbort = null;
    this.statusText.set('Hasta luego');
    this._cdr.markForCheck();
    setTimeout(() => this.close(), 450);
  }

  /**
   * Tras un turno normal, vuelve a standby para la siguiente pregunta.
   * Si el micrófono ya no está activo, queda en idle.
   */
  private resumeStandby(): void {
    if (!this.isVadActive) {
      this.state.set('idle');
      this.statusText.set('Toca para activar el asistente');
    } else {
      this.vadSpeaking = false;
      this.state.set('standby');
      this.statusText.set('Te escucho... habla cuando quieras');
      this.startStandbyTimer();
    }
    this._cdr.markForCheck();
  }

  /** 10 s en standby sin nueva frase → cerrar asistente. */
  private startStandbyTimer(): void {
    if (this.standbyTimer !== null) clearTimeout(this.standbyTimer);
    this.standbyTimer = setTimeout(() => {
      this.standbyTimer = null;
      if (this.state() === 'standby' && this.isVadActive) {
        console.log('[VAD] ⏱ 10s sin voz — cerrando asistente');
        this.statusText.set('Sin actividad');
        this._cdr.markForCheck();
        this.close();
      }
    }, this.STANDBY_SILENCE_MS);
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════
  private setError(msg: string): void {
    console.error('[VoiceModal]', msg);
    this.voiceStreamAbort?.abort();
    this.voiceStreamAbort = null;
    this.ttsQueue        = [];
    this.ttsBusy         = false;
    this.ttsOnQueueEmpty   = null;
    this.clearTtsPlayTimer();
    this.ttsPcmBuffers     = [];
    this.deactivateVad(false);
    this.closeTtsWs();
    this.state.set('error');
    this.statusText.set('Ocurrió un error');
    this.errorMessage.set(msg);
    this._cdr.markForCheck();
  }

  private closeTtsWs(): void {
    if (!this.wsTTS) return;
    this.wsTTS.onopen = this.wsTTS.onmessage = this.wsTTS.onerror = this.wsTTS.onclose = null;
    this.wsTTS.close();
    this.wsTTS = null;
  }

  private closeAudioCtx(): void {
    this.ttsGain = null;
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => { /* ignore */ });
      this.audioCtx = null;
    }
  }

  // ── Public ───────────────────────────────────────────────────
  retry(): void {
    this.errorMessage.set('');
    this.hasNoChatId.set(false);
    if (!this.chatId) {
      this.hasNoChatId.set(true);
      this.errorMessage.set('No hay una sesión de chat activa.');
      this._cdr.markForCheck();
      return;
    }
    this.state.set('idle');
    this.statusText.set('Toca para activar el asistente');
    this._cdr.markForCheck();
  }

  close(): void {
    this.voiceStreamAbort?.abort();
    this.voiceStreamAbort = null;
    this.deactivateVad(false);
    this.closeTtsWs();
    this.closeAudioCtx();
    this.closed.emit();
  }
}
