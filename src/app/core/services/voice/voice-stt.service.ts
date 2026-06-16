import { Injectable } from '@angular/core';
import { environment } from '@app/core/config/environment.config';
import { cleanSttHallucinations } from '@app/core/utils/stt-transcript.util';
import { trimTrailingSilence } from '@app/core/utils/trim-trailing-silence.util';
import {
  resolveOmnivoiceHttpUrl,
} from '@app/core/utils/omnivoice-url.util';

@Injectable({ providedIn: 'root' })
export class VoiceSttService {
  async transcribe(audioBlob: Blob, mimeType: string): Promise<string> {
    const provider = environment.voice.sttProvider;
    const trimmed = await trimTrailingSilence(audioBlob, mimeType);
    console.log(
      `[STT] provider=${provider} — ${trimmed.blob.size} bytes`
      + (trimmed.blob.size !== audioBlob.size ? ` (orig ${audioBlob.size})` : ''),
    );

    const raw = provider === 'deepinfra'
      ? await this.transcribeDeepInfra(trimmed.blob, trimmed.mimeType)
      : await this.transcribeOmnivoice(trimmed.blob, trimmed.mimeType);

    const cleaned = cleanSttHallucinations(raw);
    if (cleaned !== raw) {
      console.log('[STT] Limpieza alucinaciones:', { raw, cleaned });
    }

    return cleaned;
  }

  private async transcribeDeepInfra(audioBlob: Blob, mimeType: string): Promise<string> {
    const { transcriptionsUrl, model, apiKey } = environment.voice.deepinfra;
    if (!apiKey) {
      throw new Error('NG_APP_DEEPINFRA_API_KEY no configurada');
    }

    const ext = mimeType.includes('wav') ? 'wav' : 'webm';
    const formData = new FormData();
    formData.append('file', audioBlob, `utterance.${ext}`);
    formData.append('model', model);
    formData.append('language', 'es');
    formData.append('temperature', '0');

    const res = await fetch(transcriptionsUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = (err as Record<string, unknown>)['detail']
        ?? (err as Record<string, unknown>)['error']
        ?? (err as Record<string, unknown>)['message']
        ?? `HTTP ${res.status}`;
      throw new Error(String(detail));
    }

    const data = await res.json() as { text?: string };
    return (data.text ?? '').trim();
  }

  private async transcribeOmnivoice(audioBlob: Blob, mimeType: string): Promise<string> {
    const url = resolveOmnivoiceHttpUrl(environment.voice.omnivoice.transcribeUrl);
    const ext = mimeType.includes('wav') ? 'wav' : 'webm';

    const formData = new FormData();
    formData.append('audio', audioBlob, `utterance.${ext}`);
    formData.append('mode', 'fast');
    formData.append('language', 'es');

    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as Record<string, string>)['detail'] ?? `HTTP ${res.status}`);
    }

    const data = await res.json() as { text?: string };
    return (data.text ?? '').trim();
  }
}
