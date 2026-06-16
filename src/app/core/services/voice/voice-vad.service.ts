import { Injectable } from '@angular/core';
import { MicVAD } from '@ricky0123/vad-web';

export interface VoiceVadCallbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array) => void;
  onVADMisfire: () => void;
}

export interface VoiceVadStartOptions {
  audioContext: AudioContext;
  /** ms de silencio antes de cerrar el segmento (equiv. redemptionMs de Silero). */
  silenceMs?: number;
}

@Injectable({ providedIn: 'root' })
export class VoiceVadService {
  private micVad: MicVAD | null = null;

  async start(callbacks: VoiceVadCallbacks, options: VoiceVadStartOptions): Promise<void> {
    await this.destroy();

    const silenceMs = options.silenceMs ?? 1000;

    this.micVad = await MicVAD.new({
      startOnLoad: false,
      audioContext: options.audioContext,
      baseAssetPath: '/vad/',
      onnxWASMBasePath: '/vad/',
      model: 'legacy',
      redemptionMs: silenceMs,
      minSpeechMs: 250,
      onSpeechStart: callbacks.onSpeechStart,
      onSpeechEnd: callbacks.onSpeechEnd,
      onVADMisfire: callbacks.onVADMisfire,
      getStream: () => this.requestMicStream(),
      pauseStream: async (stream) => {
        stream.getTracks().forEach(t => t.stop());
      },
      resumeStream: () => this.requestMicStream(),
    });

    await this.micVad.start();
  }

  async pause(): Promise<void> {
    await this.micVad?.pause();
  }

  async resume(): Promise<void> {
    if (!this.micVad) return;
    await this.micVad.start();
  }

  async destroy(): Promise<void> {
    if (!this.micVad) return;
    await this.micVad.destroy();
    this.micVad = null;
  }

  get isListening(): boolean {
    return this.micVad?.listening ?? false;
  }

  private requestMicStream(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
      },
      video: false,
    });
  }
}
