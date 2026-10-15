const DEFAULT_BASE = "https://mvp.tryunsora.com/api/v1";

export function unsoraApiBaseUrl(): string {
  return process.env.UNSORA_API_BASE_URL?.trim() || DEFAULT_BASE;
}

/** A non-2xx answer from the Unsora API; `status` is the HTTP status. */
export class UnsoraApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UnsoraApiError";
  }
}

export class UnsoraApi {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = unsoraApiBaseUrl(),
  ) {}

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      idempotencyKey?: string;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      // Lets the API record posts created from an agent as "MCP".
      "X-Unsora-Client": "mcp",
    };

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey.slice(0, 128);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(120_000),
    });

    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      throw new UnsoraApiError(
        `Unsora API ${method} ${path} failed (${res.status}): ${text}`,
        res.status,
      );
    }

    return data as T;
  }

  /**
   * Poll a job every 15 s (by default) until COMPLETED or FAILED. Returns
   * `done: false` only if `maxAttempts` runs out first. Rate limits, 5xx
   * answers and network errors are retried; any other error is thrown.
   */
  private async pollStatus<T extends { data?: { status?: string } }>(
    path: string,
    defaultMaxAttempts: number,
    opts?: PollOptions,
  ): Promise<T & PollResult> {
    const max = opts?.maxAttempts ?? defaultMaxAttempts;
    const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;

    let last: T | undefined;
    let attempt = 0;
    while (attempt < max) {
      attempt++;
      try {
        last = await this.request<T>("GET", path);
        const status = last.data?.status;
        if (status === "COMPLETED" || status === "FAILED") {
          return { ...last, attempts: attempt, done: true };
        }
      } catch (error) {
        if (!isTransient(error)) throw error;
      }
      if (attempt >= max) break;
      await sleep(intervalMs);
    }

    return {
      ...(last ?? ({} as T)),
      attempts: attempt,
      done: false,
      note: "Still processing. Call this tool again with the same id to keep waiting.",
    };
  }

  pollImageStatus(id: string, opts?: PollOptions) {
    return this.pollStatus<StatusResponse>(`/image/status/${id}`, 60, opts);
  }

  pollMusicStatus(id: string, opts?: PollOptions) {
    return this.pollStatus<StatusResponse>(`/music/status/${id}`, 120, opts);
  }

  pollVoiceoverStatus(id: string, opts?: PollOptions) {
    return this.pollStatus<StatusResponse>(`/voiceovers/status/${id}`, 60, opts);
  }

  pollClippingStatus(id: string, opts?: PollOptions) {
    return this.pollStatus<{
      success: boolean;
      data: { status: string; clips?: unknown[] };
    }>(`/clippings/refresh/${id}`, 120, opts);
  }

  pollVideoStatus(id: string, opts?: PollOptions) {
    return this.pollStatus<StatusResponse>(`/video/status/${id}`, 120, opts);
  }
}

/** How often a wait_for_* call checks the job. */
const DEFAULT_INTERVAL_MS = 15_000;

export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
}

interface PollResult {
  attempts: number;
  done: boolean;
  note?: string;
}

interface StatusResponse {
  success: boolean;
  data: {
    status: string;
    outputUrl?: string | null;
    error?: string | null;
  };
}

/** Rate limits, server errors and network failures are worth retrying. */
function isTransient(error: unknown): boolean {
  if (error instanceof UnsoraApiError) {
    return error.status === 429 || error.status >= 500;
  }
  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
