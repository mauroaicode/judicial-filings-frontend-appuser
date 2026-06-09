export interface VoiceTtsSynthesisCallbacks {
  onStart?: (sampleRate: number) => void;
  onPcmChunk?: (data: ArrayBuffer) => void;
  onDone?: (durationS?: number) => void;
  onError?: (detail: string) => void;
}

export interface VoiceTtsSynthesisSession {
  cancel(): void;
}
