export type WayinTaskStatus =
  | "CREATED"
  | "QUEUED"
  | "ONGOING"
  | "SUCCEEDED"
  | "FAILED";

export interface WayinClip {
  idx: number;
  title: string;
  begin_ms: number;
  end_ms: number;
  thumbnail?: string;
  tags?: string[];
  desc?: string;
  score?: number;
  export_link?: string;
}

export interface WayinClippingResult {
  id: string;
  name?: string;
  status: WayinTaskStatus;
  error_message?: string;
  expire_at?: number;
  cost_usage?: number;
  clips?: WayinClip[];
}

export interface WayinExportResult {
  export_task_id: string;
  name?: string;
  status: WayinTaskStatus;
  error_message?: string;
  expire_at?: number;
  cost_usage?: number;
  clips?: WayinClip[];
}

export interface SubmitExportInput {
  /** Original AI Clipping or Find Moments task id. */
  project_id: string;
  /** Clip idx values to render. Omit to export every clip in the project. */
  clip_indices?: number[];
  target_lang?: string | null;
  resolution?: string;
  enable_caption?: boolean;
  caption_display?: string;
  cc_style_tpl?: string;
  ratio?: string | null;
}

export interface SubmitClippingInput {
  video_url: string;
  source_lang?: string | null;
  target_lang?: string | null;
  target_duration?: string;
  /** Natural-language Find Moments query. When set, the task is submitted to the find-moments endpoint and target_duration is ignored. */
  query?: string | null;
  project_name?: string;
  limit?: number | null;
}

const WAYIN_BASE_URL = "https://wayinvideo-api.wayin.ai/api/v2";

export class WayinAPI {
  constructor(private apiKey: string) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "x-wayinvideo-api-version": "v2",
    };
  }

  /**
   * Submit a detection-only task (enable_export: false). Rendering is done
   * separately via submitExport: with inline export, Wayin flips the task to
   * SUCCEEDED while the clips array is still empty/partial (clips only appear
   * in results as each render finishes), so a poller that stops at SUCCEEDED
   * sees 0–1 clips. Detection-only results are complete at SUCCEEDED, and the
   * dedicated export task's SUCCEEDED includes every rendered clip.
   */
  async submitClipping(input: SubmitClippingInput): Promise<string> {
    const isFindMoments = Boolean(input.query?.trim());

    const body: Record<string, unknown> = {
      video_url: input.video_url,
      enable_export: false,
    };

    if (isFindMoments) {
      body.query = input.query!.trim();
    } else {
      body.target_duration = input.target_duration ?? "DURATION_0_90";
    }

    if (input.project_name) body.project_name = input.project_name;
    if (input.source_lang) body.source_lang = input.source_lang;
    if (input.target_lang) body.target_lang = input.target_lang;
    if (input.limit != null) body.limit = input.limit;

    const endpoint = isFindMoments
      ? `${WAYIN_BASE_URL}/clips/find-moments`
      : `${WAYIN_BASE_URL}/clips`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Wayin submit failed — HTTP ${response.status}: ${errorText}`,
      );
    }

    const json = (await response.json()) as { data?: { id?: string } };
    const taskId = json.data?.id;
    if (!taskId) {
      throw new Error("Wayin submit failed — missing task id");
    }

    return taskId;
  }

  async getResults(
    taskId: string,
    findMoments = false,
  ): Promise<WayinClippingResult> {
    const path = findMoments
      ? `clips/find-moments/results/${taskId}`
      : `clips/results/${taskId}`;
    const response = await fetch(`${WAYIN_BASE_URL}/${path}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Wayin results failed — HTTP ${response.status}: ${errorText}`,
      );
    }

    const json = (await response.json()) as { data?: WayinClippingResult };
    if (!json.data) {
      throw new Error("Wayin results failed — missing data");
    }

    return json.data;
  }

  async poll(
    taskId: string,
    onProgress?: (result: WayinClippingResult) => Promise<void>,
    findMoments = false,
  ): Promise<WayinClippingResult> {
    return pollUntilDone(() => this.getResults(taskId, findMoments), onProgress);
  }

  /** Render clips from an existing clipping/find-moments task. Returns the export task id. */
  async submitExport(input: SubmitExportInput): Promise<string> {
    const body: Record<string, unknown> = {
      project_id: input.project_id,
      resolution: input.resolution ?? "FHD_1080",
    };

    if (input.clip_indices?.length) body.clip_indices = input.clip_indices;
    if (input.target_lang) body.target_lang = input.target_lang;
    if (input.enable_caption) {
      body.enable_caption = true;
      body.cc_style_tpl = input.cc_style_tpl ?? "temp-7";
      if (input.caption_display) body.caption_display = input.caption_display;
    }
    if (input.ratio) {
      body.enable_ai_reframe = true;
      body.ratio = input.ratio;
    }

    const response = await fetch(`${WAYIN_BASE_URL}/clips/export`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Wayin export submit failed — HTTP ${response.status}: ${errorText}`,
      );
    }

    const json = (await response.json()) as {
      data?: { export_task_id?: string };
    };
    const taskId = json.data?.export_task_id;
    if (!taskId) {
      throw new Error("Wayin export submit failed — missing export task id");
    }

    return taskId;
  }

  async getExportResults(exportTaskId: string): Promise<WayinExportResult> {
    const response = await fetch(
      `${WAYIN_BASE_URL}/clips/export/${exportTaskId}`,
      { headers: this.headers() },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Wayin export results failed — HTTP ${response.status}: ${errorText}`,
      );
    }

    const json = (await response.json()) as { data?: WayinExportResult };
    if (!json.data) {
      throw new Error("Wayin export results failed — missing data");
    }

    return json.data;
  }

  async pollExport(
    exportTaskId: string,
    onProgress?: (result: WayinExportResult) => Promise<void>,
  ): Promise<WayinExportResult> {
    return pollUntilDone(() => this.getExportResults(exportTaskId), onProgress);
  }
}

async function pollUntilDone<T extends { status: WayinTaskStatus }>(
  fetchResult: () => Promise<T>,
  onProgress?: (result: T) => Promise<void>,
): Promise<T> {
  let networkRetries = 0;
  const maxNetworkRetries = 5;

  while (true) {
    try {
      const result = await fetchResult();
      networkRetries = 0;

      if (onProgress) {
        await onProgress(result);
      }

      if (result.status === "SUCCEEDED" || result.status === "FAILED") {
        return result;
      }

      await delay(8000);
    } catch (error) {
      if (networkRetries < maxNetworkRetries) {
        networkRetries++;
        await delay(3000);
        continue;
      }
      throw error;
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
