export type VoiceSttProviderId = 'deepinfra' | 'omnivoice';
export type VoiceTtsProviderId = 'deepgram' | 'omnivoice';

export interface VoiceEnvironmentConfig {
  sttProvider: VoiceSttProviderId;
  ttsProvider: VoiceTtsProviderId;
  deepinfra: {
    transcriptionsUrl: string;
    model: string;
    apiKey: string;
  };
  deepgram: {
    ttsUrl: string;
    model: string;
    apiKey: string;
  };
  omnivoice: {
    transcribeUrl: string;
    ttsWsUrl: string;
    ttsVoiceId: string;
  };
}
