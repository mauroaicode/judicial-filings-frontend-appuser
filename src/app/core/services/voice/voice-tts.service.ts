import { Injectable } from '@angular/core';
import { environment } from '@app/core/config/environment.config';
import { startDeepgramTts, prefetchDeepgramPcm } from './deepgram-tts.provider';
import { startOmnivoiceTts } from './omnivoice-tts.provider';
import type {
  VoiceTtsSynthesisCallbacks,
  VoiceTtsSynthesisSession,
} from './voice-tts.types';

@Injectable({ providedIn: 'root' })
export class VoiceTtsService {
  startSynthesis(
    text: string,
    callbacks: VoiceTtsSynthesisCallbacks,
  ): VoiceTtsSynthesisSession {
    const provider = environment.voice.ttsProvider;
    console.log(`[TTS] provider=${provider} —`, text.slice(0, 80));

    if (provider === 'deepgram') {
      return startDeepgramTts(text, callbacks);
    }
    return startOmnivoiceTts(text, callbacks);
  }

  /**
   * Dispara la síntesis en segundo plano y devuelve los bytes PCM16 listos
   * para reproducir.  Solo Deepgram soporta prefetch (REST HTTP); OmniVoice
   * devuelve null (el caller cae en síntesis directa).
   */
  prefetch(text: string): Promise<ArrayBuffer | null> {
    if (environment.voice.ttsProvider === 'deepgram') {
      console.log('[TTS] prefetch →', text.slice(0, 60));
      return prefetchDeepgramPcm(text);
    }
    return Promise.resolve(null);
  }
}
