interface ApiResponse {
  data: {
    id: string;
    status: string;
    outputs?: string[];
    error?: string;
  };
}

export interface WavespeedResult {
  outputs: string[];
  taskId: string;
  status: "completed" | "failed";
  error?: string;
}

// Seedream v5.0 Lite accepts width/height in this range, expressed via `size`.
const SEEDREAM_MIN_EDGE = 1440;
const SEEDREAM_MAX_EDGE = 8192;

/**
 * Build a Seedream `"WIDTH*HEIGHT"` size string from an aspect ratio and credit
 * tier. The long edge targets ~2K (basic) or ~4K (high); the short edge is
 * raised to the 1440 minimum (keeping the ratio) and both are clamped to 8192.
 */
function seedreamSize(aspectRatio?: string, resolution?: string): string {
  const target = resolution === "high" ? 4096 : 2048;

  const [rw, rh] = (aspectRatio ?? "1:1")
    .split(":")
    .map((n) => Number(n));
  const ratioW = rw > 0 ? rw : 1;
  const ratioH = rh > 0 ? rh : 1;

  const longest = Math.max(ratioW, ratioH);
  let width = Math.round((ratioW / longest) * target);
  let height = Math.round((ratioH / longest) * target);

  const shortest = Math.min(width, height);
  if (shortest < SEEDREAM_MIN_EDGE) {
    const scale = SEEDREAM_MIN_EDGE / shortest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  width = Math.min(width, SEEDREAM_MAX_EDGE);
  height = Math.min(height, SEEDREAM_MAX_EDGE);

  return `${width}*${height}`;
}

export class WavespeedAPI {
  private apiKey: string;
  private baseUrl = "https://api.wavespeed.ai/api/v3";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // ── Core ──────────────────────────────────────────────────────────

  /**
   * Submit a task and return the taskId without polling.
   * Save this taskId to your DB so workers can resume polling on restart.
   */
  async submit(
    model: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${model}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error(
          `WaveSpeed API unauthorized (401). Regenerate WAVESPEED_API_KEY at wavespeed.ai/accesskey — keys require an account top-up to activate. Response: ${errorText}`,
        );
      }
      throw new Error(`Submit failed — HTTP ${response.status}: ${errorText}`);
    }

    const { data }: ApiResponse = await response.json();

    return data.id;
  }

  /**
   * Poll an existing taskId until it completes or fails.
   * Safe to call on worker restart with a previously saved taskId.
   */
  async poll(taskId: string): Promise<WavespeedResult> {
    let retries = 0;
    const MAX_NETWORK_RETRIES = 5;

    while (true) {
      try {
        const response = await fetch(
          `${this.baseUrl}/predictions/${taskId}/result`,
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        );

        if (!response.ok) {
          if (response.status >= 500 && retries < MAX_NETWORK_RETRIES) {
            retries++;
            await this.delay(2000);
            continue;
          }
          const errorText = await response.text();
          return this.fail(taskId, `HTTP ${response.status}: ${errorText}`);
        }

        const { data }: ApiResponse = await response.json();

        if (data.status === "completed") {
          return {
            outputs: data.outputs ?? [],
            taskId,
            status: "completed",
          };
        }

        if (data.status === "failed") {
          return this.fail(taskId, data.error || "Processing failed");
        }

        retries = 0;
        await this.delay(2000);
      } catch (err) {
        if (retries < MAX_NETWORK_RETRIES) {
          retries++;
          await this.delay(3000);
          continue;
        }
        return this.fail(
          taskId,
          err instanceof Error ? err.message : "Polling failed",
        );
      }
    }
  }

  /**
   * Submit + poll in one call. Convenience for cases where you don't
   * need to persist the taskId between steps.
   */
  async run(
    model: string,
    input: Record<string, unknown>,
  ): Promise<WavespeedResult> {
    const taskId = await this.submit(model, input);
    return this.poll(taskId);
  }

  private fail(taskId: string, error: string): WavespeedResult {
    return { outputs: [], taskId, status: "failed", error };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Input builders ────────────────────────────────────────────────
  // Builds the { model, input } pair for each task type so queue workers
  // can call submit() and poll() separately while reusing input logic.

  static imageGenerationInput(params: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
    outputFormat?: string;
    modelKey?: string;
  }): { model: string; input: Record<string, unknown> } {
    if (params.modelKey === "seedream-v5-lite") {
      return WavespeedAPI.seedreamInput(params);
    }
    if (params.modelKey === "gpt-image-2") {
      return WavespeedAPI.gptImage2Input(params);
    }

    const hasRefs = params.referenceImages && params.referenceImages.length > 0;
    const model = hasRefs
      ? "google/nano-banana-2/edit"
      : "google/nano-banana-2/text-to-image";

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      resolution: params.resolution,
      output_format: params.outputFormat ?? "png",
      enable_base64_output: false,
      enable_sync_mode: false,
    };

    if (params.aspectRatio && params.aspectRatio !== "auto") {
      input.aspect_ratio = params.aspectRatio;
    }
    if (hasRefs) {
      input.images = params.referenceImages;
    }

    return { model, input };
  }

  /**
   * OpenAI GPT Image 2 on WaveSpeed — text-to-image and edit (reference images).
   * @see https://wavespeed.ai/models/openai/gpt-image-2/text-to-image
   * @see https://wavespeed.ai/models/openai/gpt-image-2/edit
   */
  static gptImage2Input(params: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
  }): { model: string; input: Record<string, unknown> } {
    const hasRefs =
      Boolean(params.referenceImages && params.referenceImages.length > 0);
    const model = hasRefs
      ? "openai/gpt-image-2/edit"
      : "openai/gpt-image-2/text-to-image";

    const resRaw = (params.resolution ?? "1k").toString().trim().toLowerCase();
    
    const resolution = ["1k", "2k", "4k"].includes(resRaw) ? resRaw : "1k";

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      resolution,
      quality: "medium",
      enable_base64_output: false,
      enable_sync_mode: false,
    };

    if (params.aspectRatio && params.aspectRatio !== "auto") {
      input.aspect_ratio = params.aspectRatio;
    }

    if (hasRefs) {
      input.images = params.referenceImages;
    }

    return { model, input };
  }

  /**
   * ByteDance Seedream v5.0 Lite on WaveSpeed — text-to-image and edit (reference images).
   * Seedream has no `aspect_ratio` field; the ratio + resolution tier are encoded
   * into a `"WIDTH*HEIGHT"` `size` string (both dims clamped to 1440–8192).
   * `resolution` maps the credit tier to a target long edge: basic→2K, high→4K.
   * @see https://wavespeed.ai/models/bytedance/seedream-v5.0-lite
   */
  static seedreamInput(params: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
    outputFormat?: string;
  }): { model: string; input: Record<string, unknown> } {
    const hasRefs =
      Boolean(params.referenceImages && params.referenceImages.length > 0);
    const model = hasRefs
      ? "bytedance/seedream-v5.0-lite/edit"
      : "bytedance/seedream-v5.0-lite";

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      size: seedreamSize(params.aspectRatio, params.resolution),
      output_format: params.outputFormat ?? "png",
      enable_base64_output: false,
      enable_sync_mode: false,
    };

    if (hasRefs) {
      input.images = params.referenceImages;
    }

    return { model, input };
  }

  static imageUpscaleInput(params: {
    image: string;
    targetResolution: string;
    outputFormat?: string;
  }): { model: string; input: Record<string, unknown> } {
    return {
      model: "wavespeed-ai/ultimate-image-upscaler",
      input: {
        image: params.image,
        target_resolution: params.targetResolution,
        output_format: params.outputFormat ?? "png",
        enable_base64_output: false,
        enable_sync_mode: false,
      },
    };
  }

  static watermarkRemovalInput(
    videoUrl: string,
  ): { model: string; input: Record<string, unknown> } {
    return {
      model: "wavespeed-ai/video-watermark-remover",
      input: { video: videoUrl },
    };
  }

  static videoUpscaleInput(
    videoUrl: string,
    targetResolution?: string,
  ): { model: string; input: Record<string, unknown> } {
    const input: Record<string, unknown> = {
      video: videoUrl,
      copy_audio: true,
    };
    if (targetResolution) {
      input.target_resolution = targetResolution;
    }
    return {
      model: "wavespeed-ai/video-upscaler",
      input,
    };
  }

  /**
   * Mureka AI song / BGM generation on WaveSpeed.
   * @see https://wavespeed.ai/models/mureka-ai
   */
  static murekaMusicInput(params: {
    endpoint: string;
    kind: "song" | "bgm";
    lyrics?: string;
    prompt?: string;
    numberOfSongs?: number;
    outputFormat?: string;
  }): { model: string; input: Record<string, unknown> } {
    const input: Record<string, unknown> = {
      number_of_songs: params.numberOfSongs ?? 1,
      output_format: params.outputFormat ?? "mp3",
    };

    if (params.prompt?.trim()) {
      input.prompt = params.prompt.trim();
    }

    if (params.kind === "song" && params.lyrics?.trim()) {
      input.lyrics = params.lyrics.trim();
    } else if (params.kind === "bgm" && params.lyrics?.trim() && !input.prompt) {
      input.prompt = params.lyrics.trim();
    }

    return { model: params.endpoint, input };
  }

  /**
   * MiniMax Speech 2.6 HD text-to-speech on WaveSpeed.
   * @see https://wavespeed.ai/docs/docs-api/minimax/minimax-speech-2.6-hd
   */
  static voiceTtsInput(params: {
    endpoint: string;
    text: string;
    voiceId: string;
    emotion?: string;
    speed?: number;
    outputFormat?: string;
  }): { model: string; input: Record<string, unknown> } {
    const input: Record<string, unknown> = {
      text: params.text.trim(),
      voice_id: params.voiceId,
      speed: params.speed ?? 1,
      volume: 1,
      pitch: 0,
      emotion: params.emotion ?? "neutral",
      english_normalization: true,
      format: params.outputFormat ?? "mp3",
      enable_base64_output: false,
      enable_sync_mode: false,
    };

    return { model: params.endpoint, input };
  }

  /**
   * ElevenLabs Eleven v3 text-to-speech on WaveSpeed. Output is always mp3.
   * @see https://wavespeed.ai/models/elevenlabs/eleven-v3
   */
  static elevenV3TtsInput(params: {
    endpoint: string;
    text: string;
    voiceId: string;
    stability?: number;
    similarity?: number;
    useSpeakerBoost?: boolean;
  }): { model: string; input: Record<string, unknown> } {
    const input: Record<string, unknown> = {
      text: params.text.trim(),
      voice_id: params.voiceId,
      stability: params.stability ?? 0.5,
      similarity: params.similarity ?? 1,
      use_speaker_boost: params.useSpeakerBoost ?? true,
    };

    return { model: params.endpoint, input };
  }

  /**
   * SkyReels V3 talking avatar on WaveSpeed — portrait + audio → lip-synced video.
   * @see https://wavespeed.ai/docs/docs-api/wavespeed-ai/skyreels-v3-talking-avatar
   */
  static avatarTalkingInput(params: {
    endpoint: string;
    image: string;
    audio: string;
    prompt?: string;
    resolution?: string;
    seed?: number;
  }): { model: string; input: Record<string, unknown> } {
    const input: Record<string, unknown> = {
      image: params.image,
      audio: params.audio,
      resolution: params.resolution ?? "720p",
      seed: params.seed ?? -1,
    };

    if (params.prompt?.trim()) {
      input.prompt = params.prompt.trim();
    }

    return { model: params.endpoint, input };
  }
}

// ── Factory ───────────────────────────────────────────────────────────

let wavespeedClient: WavespeedAPI | null = null;

/**
 * WAVESPEED_API_KEY as WaveSpeed expects it. Dashboard pastes often carry
 * surrounding quotes or a trailing newline, which WaveSpeed rejects as an
 * invalid key, so those are stripped. Empty string when unset.
 */
export function wavespeedApiKey(): string {
  return (process.env.WAVESPEED_API_KEY ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

function resolveWavespeedApiKey(): string {
  const apiKey = wavespeedApiKey();
  if (!apiKey) {
    throw new Error("WAVESPEED_API_KEY is not configured");
  }
  return apiKey;
}

/** Shared Wavespeed client — lazy singleton, safe to call from every queue job. */
export function getWavespeedClient(): WavespeedAPI {
  if (!wavespeedClient) {
    wavespeedClient = new WavespeedAPI(resolveWavespeedApiKey());
  }
  return wavespeedClient;
}

/** @deprecated Use getWavespeedClient() */
export function createWavespeedAPI(): WavespeedAPI {
  return getWavespeedClient();
}
