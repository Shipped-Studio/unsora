const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export const ELEVENLABS_TTS_MODEL = "eleven_multilingual_v2";
export const ELEVENLABS_STS_MODEL = "eleven_multilingual_sts_v2";

export const MAX_STS_AUDIO_SECONDS = 300;

export interface ElevenLabsVoiceCloneResult {
  voiceId: string;
}

export interface ElevenLabsTtsParams {
  voiceId: string;
  text: string;
  speed?: number;
  outputFormat?: "mp3" | "wav";
  /** More expressive delivery for spoken lyrics over a beat. */
  musicOverlay?: boolean;
  /** Conversational delivery for talking avatars — less flat/robotic. */
  avatarDelivery?: boolean;
}

export class ElevenLabsAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      "xi-api-key": this.apiKey,
    };
  }

  /** Instant Voice Clone — POST /v1/voices/add (multipart). */
  async createInstantVoiceClone(params: {
    name: string;
    description?: string;
    sampleBuffer: Buffer;
    sampleFileName: string;
    sampleMimeType: string;
  }): Promise<ElevenLabsVoiceCloneResult> {
    const form = new FormData();
    form.append("name", params.name);
    if (params.description?.trim()) {
      form.append("description", params.description.trim());
    }

    const blob = new Blob([new Uint8Array(params.sampleBuffer)], {
      type: params.sampleMimeType,
    });
    form.append("files", blob, params.sampleFileName);

    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
      method: "POST",
      headers: this.headers,
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ElevenLabs voice clone failed (${response.status}): ${body || response.statusText}`,
      );
    }

    const data = (await response.json()) as { voice_id?: string };
    if (!data.voice_id) {
      throw new Error("ElevenLabs did not return a voice_id");
    }

    return { voiceId: data.voice_id };
  }

  /** Delete a cloned voice from ElevenLabs. */
  async deleteVoice(voiceId: string): Promise<void> {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ElevenLabs delete voice failed (${response.status}): ${body || response.statusText}`,
      );
    }
  }

  /** Text-to-speech — returns raw audio bytes. */
  async textToSpeech(params: ElevenLabsTtsParams): Promise<Buffer> {
    const outputFormat =
      params.outputFormat === "wav" ? "wav_44100" : "mp3_44100_128";

    const url = new URL(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(params.voiceId)}`,
    );
    url.searchParams.set("output_format", outputFormat);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: params.text,
        model_id: ELEVENLABS_TTS_MODEL,
        voice_settings: params.musicOverlay
          ? {
              stability: 0.38,
              similarity_boost: 0.82,
              style: 0.55,
              use_speaker_boost: true,
              speed: params.speed ?? 1.05,
            }
          : params.avatarDelivery
            ? {
                stability: 0.36,
                similarity_boost: 0.82,
                style: 0.48,
                use_speaker_boost: true,
                speed: params.speed ?? 0.96,
              }
            : {
                stability: 0.5,
                similarity_boost: 0.75,
                speed: params.speed ?? 1,
              },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ElevenLabs TTS failed (${response.status}): ${body || response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Speech-to-speech voice conversion — returns raw audio bytes. */
  async speechToSpeech(params: {
    voiceId: string;
    audioBuffer: Buffer;
    audioFileName: string;
    audioMimeType: string;
    outputFormat?: "mp3" | "wav";
  }): Promise<Buffer> {
    const outputFormat =
      params.outputFormat === "wav" ? "wav_44100" : "mp3_44100_128";

    const url = new URL(
      `${ELEVENLABS_BASE_URL}/speech-to-speech/${encodeURIComponent(params.voiceId)}`,
    );
    url.searchParams.set("output_format", outputFormat);

    const form = new FormData();
    form.append("model_id", ELEVENLABS_STS_MODEL);
    const blob = new Blob([new Uint8Array(params.audioBuffer)], {
      type: params.audioMimeType,
    });
    form.append("audio", blob, params.audioFileName);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.headers,
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ElevenLabs voice conversion failed (${response.status}): ${body || response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

let cachedClient: ElevenLabsAPI | null = null;

export function getElevenLabsClient(): ElevenLabsAPI {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  if (!cachedClient) {
    cachedClient = new ElevenLabsAPI(apiKey);
  }

  return cachedClient;
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}
