export interface TrimTrailingSilenceOptions {
  /** RMS por ventana; por debajo se considera silencio. */
  threshold?: number;
  windowMs?: number;
  /** Cola mínima que se conserva tras la última voz detectada. */
  keepTailMs?: number;
}

export interface TrimmedAudio {
  blob: Blob;
  mimeType: string;
}

/**
 * Recorta silencio al final del audio antes de STT (reduce alucinaciones Whisper).
 * Si falla el decode, devuelve el blob original sin modificar.
 */
export async function trimTrailingSilence(
  audioBlob: Blob,
  mimeType: string,
  options: TrimTrailingSilenceOptions = {},
): Promise<TrimmedAudio> {
  const threshold = options.threshold ?? 0.008;
  const windowMs = options.windowMs ?? 20;
  const keepTailMs = options.keepTailMs ?? 150;

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const windowSamples = Math.max(1, Math.floor((windowMs / 1000) * sampleRate));
    const keepTailSamples = Math.floor((keepTailMs / 1000) * sampleRate);
    const totalSamples = audioBuffer.length;

    let lastSpeechEnd = totalSamples;

    for (let i = totalSamples - windowSamples; i >= 0; i -= windowSamples) {
      const end = Math.min(i + windowSamples, totalSamples);
      let maxRms = 0;

      for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        let sum = 0;
        for (let j = i; j < end; j++) {
          sum += data[j] * data[j];
        }
        maxRms = Math.max(maxRms, Math.sqrt(sum / (end - i)));
      }

      if (maxRms > threshold) {
        lastSpeechEnd = Math.min(i + windowSamples + keepTailSamples, totalSamples);
        break;
      }
    }

    if (lastSpeechEnd >= totalSamples || lastSpeechEnd <= 0) {
      await audioContext.close();
      return { blob: audioBlob, mimeType };
    }

    const trimmedBuffer = audioContext.createBuffer(channels, lastSpeechEnd, sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      trimmedBuffer.copyToChannel(
        audioBuffer.getChannelData(ch).subarray(0, lastSpeechEnd),
        ch,
      );
    }

    const wavBlob = audioBufferToWav(trimmedBuffer);
    await audioContext.close();

    return { blob: wavBlob, mimeType: 'audio/wav' };
  } catch (error) {
    console.warn('[STT] No se pudo recortar silencio trailing; se usa audio original.', error);
    return { blob: audioBlob, mimeType };
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
