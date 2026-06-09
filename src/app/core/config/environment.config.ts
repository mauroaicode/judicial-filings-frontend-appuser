import type { VoiceSttProviderId, VoiceTtsProviderId } from './voice-providers.types';

function resolveVoiceProvider<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = (value || '').toLowerCase();
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

const voiceSttProvider = resolveVoiceProvider<VoiceSttProviderId>(
  import.meta.env.NG_APP_VOICE_STT_PROVIDER,
  ['deepinfra', 'omnivoice'],
  'deepinfra',
);

const voiceTtsProvider = resolveVoiceProvider<VoiceTtsProviderId>(
  import.meta.env.NG_APP_VOICE_TTS_PROVIDER,
  ['deepgram', 'omnivoice'],
  'deepgram',
);

export const environment = {
  systemName: import.meta.env.NG_APP_SYSTEM_NAME || 'Tribunal de Ética Médica',
  baseUrl: import.meta.env.NG_APP_BASE_URL || '',
  publicKey: import.meta.env.NG_APP_PUBLIC_KEY || '',
  apiV2: import.meta.env.NG_APP_API_V2 || '',
  apiV3: import.meta.env.NG_APP_API_V3 || '',
  apiBaseUrl: import.meta.env.NG_APP_API_BASE_URL || '',
  encryptionSecretKey: import.meta.env.NG_APP_ENCRYPTION_SECRET_KEY || '',
  menuTitle: import.meta.env.NG_APP_MENU_TITLE || '',
  reverb: {
    appId: import.meta.env.NG_APP_REVERB_APP_ID || '',
    appKey: import.meta.env.NG_APP_REVERB_APP_KEY || '',
    appSecret: import.meta.env.NG_APP_REVERB_APP_SECRET || '',
    host: import.meta.env.NG_APP_REVERB_HOST || '127.0.0.1',
    port: import.meta.env.NG_APP_REVERB_PORT || 8080,
    scheme: import.meta.env.NG_APP_REVERB_SCHEME || 'http',
  },
  voice: {
    sttProvider: voiceSttProvider,
    ttsProvider: voiceTtsProvider,
    deepinfra: {
      transcriptionsUrl:
        import.meta.env.NG_APP_DEEPINFRA_TRANSCRIPTIONS_URL ||
        'https://api.deepinfra.com/v1/audio/transcriptions',
      model:
        import.meta.env.NG_APP_DEEPINFRA_STT_MODEL ||
        'openai/whisper-large-v3-turbo',
      apiKey: import.meta.env.NG_APP_DEEPINFRA_API_KEY || '',
    },
    deepgram: {
      ttsUrl:
        import.meta.env.NG_APP_DEEPGRAM_TTS_URL ||
        'https://api.deepgram.com/v1/speak',
      model:
        import.meta.env.NG_APP_DEEPGRAM_TTS_MODEL ||
        'aura-2-celeste-es',
      apiKey: import.meta.env.NG_APP_DEEPGRAM_API_KEY || '',
    },
    omnivoice: {
      transcribeUrl:
        import.meta.env.NG_APP_OMNIVOICE_TRANSCRIBE_URL ||
        'https://kdhe3t42xdtc42-3900.proxy.runpod.net/transcribe',
      ttsWsUrl:
        import.meta.env.NG_APP_OMNIVOICE_TTS_WS_URL ||
        'wss://kdhe3t42xdtc42-3900.proxy.runpod.net/ws/tts',
      ttsVoiceId: import.meta.env.NG_APP_OMNIVOICE_TTS_VOICE_ID || 'e70acddc',
    },
  },
};
