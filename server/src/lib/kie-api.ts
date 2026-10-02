// ── Image task types ──────────────────────────────────────────────────

interface CreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface TaskDetailResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    costTime?: number;
  };
}

// ── Veo task types ────────────────────────────────────────────────────

interface VeoDetailResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    successFlag: 0 | 1 | 2 | 3;
    response?: {
      taskId: string;
      resultUrls?: string[] | null;
      fullResultUrls?: string[];
      originUrls?: string[] | null;
      resolution?: string;
    };
    errorCode?: number | null;
    errorMessage?: string | null;
    fallbackFlag?: boolean;
  };
}

export interface KieResult {
  outputs: string[];
  taskId: string;
  status: "completed" | "failed";
  error?: string;
}

/**
 * Parse `resultJson` from `/jobs/recordInfo` for image/video tasks (Seedance, Nano Banana, etc.).
 */
export function parseKieJobMediaUrls(resultJson?: string): string[] {
  if (!resultJson?.trim()) return [];
  try {
    const parsed = JSON.parse(resultJson) as Record<string, unknown>;

    const urlsField = parsed.resultUrls;
    if (Array.isArray(urlsField)) {
      const out = urlsField.filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      );
      if (out.length > 0) return out;
    }

    for (const key of ["video_url", "videoUrl", "url", "outputUrl"]) {
      const v = parsed[key];
      if (typeof v === "string" && v.length > 0) return [v];
    }

    const output = parsed.output;
    if (output && typeof output === "object") {
      const o = output as Record<string, unknown>;
      for (const key of ["video_url", "url"]) {
        const v = o[key];
        if (typeof v === "string" && v.length > 0) return [v];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export class KieAPI {
  private apiKey: string;
  private baseUrl = "https://api.kie.ai/api/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // ── Image tasks (submit / poll) ─────────────────────────────────────

  /**
   * Submit a task and return the taskId without polling.
   * Save this taskId to your DB so workers can resume polling on restart.
   */
  async submit(
    model: string,
    input: Record<string, unknown>,
    opts?: { callBackUrl?: string },
  ): Promise<string> {
    const payload: Record<string, unknown> = { model, input };
    if (opts?.callBackUrl) {
      payload.callBackUrl = opts.callBackUrl;
    }

    const response = await fetch(`${this.baseUrl}/jobs/createTask`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submit failed — HTTP ${response.status}: ${errorText}`);
    }

    const body: CreateTaskResponse = await response.json();

    if (body.code !== 200) {
      throw new Error(`Submit failed — API code ${body.code}: ${body.msg}`);
    }

    return body.data.taskId;
  }

  /**
   * Poll an existing taskId until it completes or fails.
   * Safe to call on worker restart with a previously saved taskId.
   */
  async poll(taskId: string): Promise<KieResult> {
    const POLL_INTERVAL = 3000;
    const MAX_CONSECUTIVE_ERRORS = 10;
    let consecutiveErrors = 0;

    while (true) {
      try {
        const url = `${this.baseUrl}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });

        if (!response.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            const errorText = await response.text();
            return this.fail(taskId, `HTTP ${response.status}: ${errorText}`);
          }
          await this.delay(POLL_INTERVAL);
          continue;
        }

        const body: TaskDetailResponse = await response.json();

        if (body.code !== 200) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            return this.fail(taskId, `API code ${body.code}: ${body.msg}`);
          }
          await this.delay(POLL_INTERVAL);
          continue;
        }

        consecutiveErrors = 0;
        const { data } = body;

        if (data.state === "success") {
          return {
            outputs: parseKieJobMediaUrls(data.resultJson),
            taskId,
            status: "completed",
          };
        }

        if (data.state === "fail") {
          return this.fail(taskId, data.failMsg || data.failCode || "Processing failed");
        }

        await this.delay(POLL_INTERVAL);
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          return this.fail(taskId, err instanceof Error ? err.message : "Polling failed");
        }
        await this.delay(POLL_INTERVAL);
      }
    }
  }

  /**
   * Single fetch for unified job status ([Get Task Details](https://docs.kie.ai/market/common/get-task-detail)).
   */
  async fetchJobRecord(taskId: string): Promise<TaskDetailResponse | null> {
    try {
      const url = `${this.baseUrl}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as TaskDetailResponse;
    } catch {
      return null;
    }
  }

  /**
   * Poll a Veo video task. Uses /veo/record-info which returns
   * successFlag (0=generating, 1=success, 2=failed, 3=generation failed)
   * and nests video URLs in data.response.resultUrls.
   */
  async pollVeo(taskId: string): Promise<KieResult> {
    const POLL_INTERVAL = 3000;
    const MAX_CONSECUTIVE_ERRORS = 10;
    let consecutiveErrors = 0;

    while (true) {
      try {
        const url = `${this.baseUrl}/veo/record-info?taskId=${encodeURIComponent(taskId)}`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });

        if (!response.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            const errorText = await response.text();
            return this.fail(taskId, `HTTP ${response.status}: ${errorText}`);
          }
          await this.delay(POLL_INTERVAL);
          continue;
        }

        const body: VeoDetailResponse = await response.json();

        if (body.code !== 200) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            return this.fail(taskId, `API code ${body.code}: ${body.msg}`);
          }
          await this.delay(POLL_INTERVAL);
          continue;
        }

        consecutiveErrors = 0;
        const { data } = body;

        if (data.successFlag === 1) {
          const urls = data.response?.resultUrls ?? data.response?.fullResultUrls ?? [];
          return { outputs: urls, taskId, status: "completed" };
        }

        if (data.successFlag === 2 || data.successFlag === 3) {
          return this.fail(taskId, data.errorMessage || "Video generation failed");
        }

        // successFlag 0 — still generating
        await this.delay(POLL_INTERVAL);
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          return this.fail(taskId, err instanceof Error ? err.message : "Polling failed");
        }
        await this.delay(POLL_INTERVAL);
      }
    }
  }

  /**
   * Submit + poll in one call. Convenience for cases where you don't
   * need to persist the taskId between steps.
   */
  async run(model: string, input: Record<string, unknown>): Promise<KieResult> {
    const taskId = await this.submit(model, input);
    return this.poll(taskId);
  }

  private parseResultUrls(resultJson?: string): string[] {
    return parseKieJobMediaUrls(resultJson);
  }

  /**
   * ByteDance Seedance via Kie `jobs/createTask`.
   * @see https://docs.kie.ai/market/bytedance/seedance-2
   * @see https://docs.kie.ai/market/bytedance/seedance-2-fast
   */
  static seedanceVideoTask(
    prompt: string,
    apiBody: {
      model: string;
      functionMode: string;
      ratio: string;
      duration: number;
      resolution: string;
      image_files?: string[];
      video_files?: string[];
      audio_files?: string[];
      filePaths?: string[];
      generate_audio?: boolean;
    },
  ): { model: string; input: Record<string, unknown> } {
    const kieModel =
      apiBody.model === "seedance_2.0"
        ? "bytedance/seedance-2"
        : "bytedance/seedance-2-fast";

    const input: Record<string, unknown> = {
      prompt,
      resolution: apiBody.resolution,
      aspect_ratio: apiBody.ratio,
      duration: apiBody.duration,
      generate_audio: apiBody.generate_audio ?? false,
      nsfw_checker: false,
    };

    if (apiBody.functionMode === "first_last_frames") {
      const paths = apiBody.filePaths ?? [];
      if (paths[0]) input.first_frame_url = paths[0];
      if (paths[1]) input.last_frame_url = paths[1];
    } else {
      if (apiBody.image_files?.length) {
        input.reference_image_urls = apiBody.image_files;
      }
      if (apiBody.video_files?.length) {
        input.reference_video_urls = apiBody.video_files;
      }
      if (apiBody.audio_files?.length) {
        input.reference_audio_urls = apiBody.audio_files;
      }
    }

    return { model: kieModel, input };
  }

  private fail(taskId: string, error: string): KieResult {
    return { outputs: [], taskId, status: "failed", error };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Input builders ────────────────────────────────────────────────

  static imageGenerationInput(params: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
    outputFormat?: string;
    modelKey?: string;
    nsfwChecker?: boolean;
  }): { model: string; input: Record<string, unknown> } {
    if (params.modelKey === "seedream-v5-lite") {
      return KieAPI.seedreamInput(params);
    }
    if (params.modelKey === "gpt-image-2") {
      return KieAPI.gptImage2Input(params);
    }

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      resolution: params.resolution?.toUpperCase() ?? "1K",
      output_format: params.outputFormat ?? "png",
    };

    if (params.aspectRatio && params.aspectRatio !== "auto") {
      input.aspect_ratio = params.aspectRatio;
    }

    if (params.referenceImages && params.referenceImages.length > 0) {
      input.image_input = params.referenceImages;
    }

    return { model: "nano-banana-pro", input };
  }

  /** KIE GPT Image 2 — see docs.kie.ai market/gpt/gpt-image-2-* */
  private static gptImage2Input(params: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
  }): { model: string; input: Record<string, unknown> } {
    const kieGpt2Ratios = new Set([
      "1:1",
      "9:16",
      "16:9",
      "4:3",
      "3:4",
    ]);
    const hasRefs =
      params.referenceImages && params.referenceImages.length > 0;
    let aspect =
      params.aspectRatio && params.aspectRatio !== "auto"
        ? params.aspectRatio
        : "auto";
    if (aspect !== "auto" && !kieGpt2Ratios.has(aspect)) {
      aspect = "auto";
    }

    let resolution = (params.resolution ?? "1K").toUpperCase();
    if (aspect === "auto") {
      resolution = "1K";
    } else if (aspect === "1:1" && resolution === "4K") {
      resolution = "2K";
    }

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      resolution,
    };
    if (aspect !== "auto") {
      input.aspect_ratio = aspect;
    }

    if (hasRefs) {
      input.input_urls = params.referenceImages;
      return { model: "gpt-image-2-image-to-image", input };
    }

    return { model: "gpt-image-2-text-to-image", input };
  }

  private static seedreamInput(params: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
    nsfwChecker?: boolean;
  }): { model: string; input: Record<string, unknown> } {
    const hasRefs = params.referenceImages && params.referenceImages.length > 0;
    const model = hasRefs
      ? "seedream/5-lite-image-to-image"
      : "seedream/5-lite-text-to-image";

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      quality: params.resolution ?? "basic",
    };

    if (params.aspectRatio && params.aspectRatio !== "auto") {
      input.aspect_ratio = params.aspectRatio;
    }

    if (params.nsfwChecker !== undefined) {
      input.nsfw_checker = params.nsfwChecker;
    }

    if (hasRefs) {
      input.image_urls = params.referenceImages;
    }

    return { model, input };
  }
}

// ── Factory ───────────────────────────────────────────────────────────

let kieClient: KieAPI | null = null;

function resolveKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY || process.env.SEEDANCE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY is not configured (legacy SEEDANCE_API_KEY is also accepted)",
    );
  }
  return apiKey;
}

/** Shared Kie client — lazy singleton, safe to call from every queue job. */
export function getKieClient(): KieAPI {
  if (!kieClient) {
    kieClient = new KieAPI(resolveKieApiKey());
  }
  return kieClient;
}

/** @deprecated Use getKieClient() */
export function createKieAPI(): KieAPI {
  return getKieClient();
}
