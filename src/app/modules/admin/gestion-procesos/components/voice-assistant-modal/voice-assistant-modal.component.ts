/**
 * Voice assistant with automatic VAD (Voice Activity Detection).
 *
 * State machine:
 *   idle → (tap) → standby [mic open, VAD loop running, waiting for speech]
 *   standby → (speech detected) → listening [MediaRecorder capturing]
 *   listening → (silence 1.5 s) → transcribing [POST /transcribe]
 *   transcribing → thinking [POST /ai-chats/{id}/voice SSE]
 *   thinking → waiting   [TTS del wait sonando; answer en prefetch paralelo]
 *   waiting  → preparingAnswer [wait terminó; esperando prefetch del answer]
 *   preparingAnswer → speaking [answer listo; reproduciendo]
 *   speaking → standby [auto-cycle] o cierre si conversation_end / 10s sin voz
 *
 * Tap while standby/listening → deactivate → idle.
 * conversation_end (SSE) → TTS despedida → cerrar modal.
 * 10 s en standby sin hablar → cerrar modal.
 *
 * Optimizaciones de latencia (inspiradas en NotiJudicial-iOS):
 *   • Prefetch: el HTTP TTS del answer arranca en cuanto llega el SSE `done`,
 *     mientras el wait todavía suena → cero silencio entre wait y answer.
 *   • Sentence chunker: el answer se divide en frases (~160 chars) para
 *     que la primera frase se reproduzca antes aunque la respuesta sea larga.
 *   • Normalización de pico (0.85) para volumen consistente entre frases.
 *
 * VAD: Silero via @ricky0123/vad-web (MicVAD + ONNX Runtime WASM).
 */
import {
  Component, Input, Output, EventEmitter,
  signal, OnDestroy, OnInit,
  ChangeDetectionStrategy, inject, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { utils as vadUtils } from '@ricky0123/vad-web';
import { AiVoiceChatService } from 'src/app/core/services/ai-voice-chat/ai-voice-chat.service';
import { VoiceSttService } from '@app/core/services/voice/voice-stt.service';
import { VoiceTtsService } from '@app/core/services/voice/voice-tts.service';
import { VoiceVadService } from '@app/core/services/voice/voice-vad.service';
import { splitIntoTtsSentences } from '@app/core/services/voice/tts-sentence-chunker';
import type { VoiceTtsSynthesisSession } from '@app/core/services/voice/voice-tts.types';

export type VoiceState =
  | 'idle'
  | 'standby'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'waiting'
  | 'preparingAnswer'
  | 'speaking'
  | 'error';

interface TtsQueueItem {
  text:      string;
  kind:      'wait' | 'answer';
  prefetch?: Promise<ArrayBuffer | null>;
}

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
  private _voiceStt     = inject(VoiceSttService);
  private _voiceTts     = inject(VoiceTtsService);
  private _voiceVad     = inject(VoiceVadService);

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

  /** Debounce tras "done" para PCM tardíos (WS OmniVoice; REST Deepgram ya tiene todo). */
  private static readonly TTS_TAIL_FLUSH_MS        = 60;
  private static readonly TTS_TAIL_MAX_ATTEMPTS    = 3;
  private static readonly TTS_DURATION_FILL_RATIO  = 0.97;
  /** Silencio programado (AudioContext) entre wait y answer. */
  private static readonly TTS_PHRASE_GAP_SEC       = 0.30;
  private static readonly TTS_POST_PHRASE_PAUSE_MS = 200;
  /** Progress en pantalla; voz solo en wait + answer (menos espera total). */
  private static readonly TTS_SPEAK_PROGRESS_AUDIO = false;

  // ── TTS (Deepgram REST u OmniVoice WS) + cola ─────────────────
  private ttsSession:       VoiceTtsSynthesisSession | null = null;
  private ttsQueue:         TtsQueueItem[]                  = [];
  private _ttsCurrentKind:  'wait' | 'answer'               = 'wait';
  private ttsBusy           = false;
  private ttsOnQueueEmpty:  (() => void) | null             = null;

  // ── SSE voz (Laravel) ─────────────────────────────────────────
  private voiceStreamAbort: AbortController | null = null;
  /** Evita doble TTS: meta.wait_message y progress immediate suelen ser el mismo texto. */
  private waitPlayed = false;
  /** Cerrar modal tras reproducir la respuesta final (despedida del cerebro). */
  private pendingConversationEnd = false;

  // ── Microphone & VAD (Silero) ─────────────────────────────────
  private isVadActive  = false;
  private vadSpeaking  = false;
  private standbyTimer:  ReturnType<typeof setTimeout> | null = null;

  /** ms de silencio antes de cerrar el segmento de voz. */
  private readonly SILENCE_DURATION_MS = 1000;
  /** ms en standby sin hablar antes de cerrar el asistente. */
  private readonly STANDBY_SILENCE_MS = 10_000;
  private static readonly VAD_SAMPLE_RATE = 16000;

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
    this.cancelTtsSession();
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

    this._voiceVad.start({
      onSpeechStart: () => this.onVadSpeechStart(),
      onSpeechEnd:   audio => this.onVadSpeechEnd(audio),
      onVADMisfire:  () => this.onVadMisfire(),
    }, {
      audioContext: this.audioCtx,
      silenceMs: this.SILENCE_DURATION_MS,
    })
      .then(() => {
        this.isVadActive = true;
        this.vadSpeaking = false;
        this.startStandbyTimer();

        console.log('[VAD] ✅ Micrófono abierto — Silero VAD activo');
        this.statusText.set('Te escucho... habla cuando quieras');
        this._cdr.markForCheck();
      })
      .catch(err => {
        console.error('[VAD] Error iniciando Silero VAD:', err);
        const detail = err instanceof Error ? err.message : String(err);
        const isMicDenied = detail.includes('Permission') || detail.includes('NotAllowed');
        this.setError(
          isMicDenied
            ? 'No se pudo acceder al micrófono. Revisa los permisos del navegador.'
            : `No se pudo iniciar el detector de voz: ${detail}`,
        );
      });
  }

  private deactivateVad(goToIdle: boolean): void {
    this.isVadActive = false;
    this.vadSpeaking = false;

    if (this.standbyTimer !== null) { clearTimeout(this.standbyTimer); this.standbyTimer = null; }

    void this._voiceVad.destroy();

    if (goToIdle) {
      this.state.set('idle');
      this.statusText.set('Toca para activar el asistente');
      this._cdr.markForCheck();
    }
  }

  private onVadSpeechStart(): void {
    if (this.state() !== 'standby') return;
    if (this.standbyTimer !== null) { clearTimeout(this.standbyTimer); this.standbyTimer = null; }
    this.vadSpeaking = true;

    console.log('[VAD] 🎙️ Habla detectada — grabando');
    this.state.set('listening');
    this.statusText.set('Escuchando...');
    this._cdr.markForCheck();
  }

  private onVadSpeechEnd(audio: Float32Array): void {
    this.vadSpeaking = false;
    console.log('[VAD] 🔇 Silencio detectado — segmento listo para STT');

    void this._voiceVad.pause();

    this.state.set('transcribing');
    this.statusText.set('Transcribiendo...');
    this._cdr.markForCheck();

    this.transcribeVadAudio(audio);
  }

  private onVadMisfire(): void {
    console.log('[VAD] Misfire — ruido breve descartado');
    this.vadSpeaking = false;
    if (this.state() === 'listening') {
      this.resumeStandby();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STT — HTTP POST /transcribe
  // ═══════════════════════════════════════════════════════════════
  private transcribeVadAudio(audio: Float32Array): void {
    if (audio.length === 0) {
      console.warn('[STT] Segmento de voz vacío');
      this.resumeStandby();
      return;
    }

    const wavBuffer = vadUtils.encodeWAV(
      audio,
      1,
      VoiceAssistantModalComponent.VAD_SAMPLE_RATE,
    );
    const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const mimeType = 'audio/wav';

    this._voiceStt.transcribe(audioBlob, mimeType)
      .then(text => {
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
        this.queueTts(wait, 'wait');
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
          this.queueTts(text, 'wait');
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
          this.queueAnswerChunks(answer, afterAnswer);
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
  // TTS — cola secuencial wait → answer (con prefetch y chunker)
  // ═══════════════════════════════════════════════════════════════
  private queueTts(
    text:      string,
    kind:      'wait' | 'answer',
    onAfter?:  () => void,
    prefetch?: Promise<ArrayBuffer | null>,
  ): void {
    const trimmed = text.trim();
    if (!trimmed) { onAfter?.(); return; }
    this.ttsQueue.push({ text: trimmed, kind, prefetch });
    if (onAfter) {
      const prev = this.ttsOnQueueEmpty;
      this.ttsOnQueueEmpty = () => { prev?.(); onAfter(); };
    }
    this.processTtsQueue();
  }

  /**
   * Divide la respuesta en frases cortas y encola cada una con su propio
   * prefetch HTTP disparado en paralelo.  La primera frase suena en cuanto
   * termina el wait (sin HTTP blocking), las siguientes ya están listas.
   */
  private queueAnswerChunks(answer: string, onAfter?: () => void): void {
    const sentences = splitIntoTtsSentences(answer);
    if (sentences.length === 0) { onAfter?.(); return; }

    console.log(`[TTS] chunker → ${sentences.length} frase(s); prefetch en paralelo`);
    const prefetches = sentences.map(s => this._voiceTts.prefetch(s));

    sentences.forEach((sentence, i) => {
      const isLast = i === sentences.length - 1;
      this.queueTts(sentence, 'answer', isLast ? onAfter : undefined, prefetches[i]);
    });
  }

  private processTtsQueue(): void {
    if (this.ttsBusy || this.ttsQueue.length === 0) return;
    this.ttsBusy = true;
    const { text, kind, prefetch } = this.ttsQueue.shift()!;
    this._ttsCurrentKind = kind;
    const gapBefore = this.ttsPhrasesPlayed > 0;
    this.ttsPhrasesPlayed++;

    if (kind === 'answer') {
      this.state.set('preparingAnswer');
      this.statusText.set('Preparando respuesta...');
      this._cdr.markForCheck();
    }

    this.runTtsSession(text, () => {
      this.ttsBusy = false;
      if (this.ttsQueue.length > 0) {
        this.processTtsQueue();
      } else {
        this.ttsOnQueueEmpty?.();
        this.ttsOnQueueEmpty = null;
      }
    }, gapBefore, prefetch);
  }

  private ensureTtsGain(): GainNode {
    if (!this.audioCtx) throw new Error('AudioContext no inicializado');
    if (!this.ttsGain) {
      this.ttsGain = this.audioCtx.createGain();
      this.ttsGain.connect(this.audioCtx.destination);
    }
    return this.ttsGain;
  }

  private runTtsSession(
    text:      string,
    onComplete: () => void,
    gapBefore  = false,
    prefetch?: Promise<ArrayBuffer | null>,
  ): void {
    if (!this.audioCtx) {
      onComplete();
      return;
    }
    if (this.ttsSession) {
      console.warn('[TTS] Cancelando sesión anterior (no debía seguir activa)');
      this.cancelTtsSession();
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

    if (prefetch) {
      // Ruta rápida: buffer ya descargado en paralelo con el wait
      prefetch.then(pcm => {
        if (!this.ttsSessionComplete) return; // sesión cancelada entretanto
        if (pcm && pcm.byteLength > 0) {
          const durS = pcm.byteLength / 2 / this.ttsSampleRate;
          this.ttsExpectedDurationS = durS;
          this.lastDuration.set(`${durS.toFixed(1)}s`);
          this.ttsPcmBuffers.push(pcm);
          this.ttsWsDoneReceived = true;
          this.ttsWsClosed       = true;
          console.log(`[TTS] Prefetch listo — ${pcm.byteLength} bytes (${durS.toFixed(2)}s)`);
          this.schedulePhrasePlayback();
        } else {
          console.warn('[TTS] Prefetch nulo — síntesis directa');
          this._startLiveSynthesis(text);
        }
      }).catch(() => this._startLiveSynthesis(text));
      return;
    }

    this._startLiveSynthesis(text);
  }

  private _startLiveSynthesis(text: string): void {
    let chunkCount = 0;
    this.ttsSession = this._voiceTts.startSynthesis(text, {
      onStart: sampleRate => {
        this.ttsSampleRate = sampleRate;
        this.statusText.set(
          this._ttsCurrentKind === 'wait'
            ? 'Lexa está pensando...'
            : 'Preparando respuesta...',
        );
        this._cdr.markForCheck();
      },
      onPcmChunk: data => {
        chunkCount++;
        console.log(`[TTS] Chunk #${chunkCount} — ${data.byteLength} bytes (buffered)`);
        this.ttsPcmBuffers.push(data);
        if (this.ttsWsDoneReceived && !this.ttsPhrasePlaybackStarted) {
          this.schedulePhrasePlayback();
        }
      },
      onDone: durS => {
        if (durS) {
          this.ttsExpectedDurationS = durS;
          this.lastDuration.set(`${durS.toFixed(1)}s`);
        }
        console.log(
          `[TTS] DONE — chunks: ${this.ttsPcmBuffers.length}, samples: ${this.ttsBufferedSamples()}, dur: ${durS}s`,
        );
        this.ttsWsDoneReceived = true;
        this.ttsWsClosed       = true;
        this.schedulePhrasePlayback();
      },
      onError: detail => {
        this.clearTtsPlayTimer();
        this.ttsPcmBuffers = [];
        this.ttsWsClosed   = true;
        this.finishTtsSession();
        this.setError(`Error TTS: ${detail}`);
      },
    });
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
      this.cancelTtsSessionIfActive();
      this.finishTtsSession();
      return;
    }

    this.ttsPhrasePlaybackStarted = true;
    this.cancelTtsSessionIfActive();
    console.log(
      `[TTS] ▶ Play — ${(buffered / this.ttsSampleRate).toFixed(2)}s, ${this.ttsPcmBuffers.length} chunks`,
    );
    this.playBufferedPhrase();
  }

  /** OmniVoice suele dejar el WS abierto; lo cancelamos para no bloquear la cola. */
  private cancelTtsSessionIfActive(): void {
    if (this.ttsSession) this.cancelTtsSession();
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

    // Normalización de pico (target 0.85, boost máx 3×) — volumen uniforme entre frases
    let peak = 0;
    for (let i = 0; i < float32.length; i++) {
      const abs = Math.abs(float32[i]);
      if (abs > peak) peak = abs;
    }
    if (peak > 0.001 && peak < 0.85) {
      const peakGain = Math.min(0.85 / peak, 3.0);
      for (let i = 0; i < float32.length; i++) float32[i] *= peakGain;
    }

    const fadeIn = Math.min(64, Math.max(1, Math.floor(float32.length * 0.004)));
    for (let i = 0; i < fadeIn; i++) float32[i] *= i / fadeIn;
    // Sin fade-out: en frases cortas (wait_message) comía la última sílaba.

    const audioBuffer = this.audioCtx.createBuffer(1, float32.length, this.ttsSampleRate);
    audioBuffer.getChannelData(0).set(float32);

    const now = this.audioCtx.currentTime;
    if (this.gapBeforePhrasePlay) {
      this.ttsNextPlayTime = Math.max(this.ttsNextPlayTime, now) + VoiceAssistantModalComponent.TTS_PHRASE_GAP_SEC;
      this.gapBeforePhrasePlay = false;
    } else if (this.ttsNextPlayTime < now + 0.02) {
      this.ttsNextPlayTime = now + 0.05;
    }

    this.state.set(this._ttsCurrentKind === 'wait' ? 'waiting' : 'speaking');
    this.statusText.set(this._ttsCurrentKind === 'wait' ? 'Lexa está pensando...' : 'Lexa está hablando...');
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
    this.cancelTtsSessionIfActive();
    done?.();
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
      void this._voiceVad.resume();
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
    this.cancelTtsSession();
    this.state.set('error');
    this.statusText.set('Ocurrió un error');
    this.errorMessage.set(msg);
    this._cdr.markForCheck();
  }

  private cancelTtsSession(): void {
    this.ttsSession?.cancel();
    this.ttsSession = null;
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
    this.cancelTtsSession();
    this.closeAudioCtx();
    this.closed.emit();
  }
}
