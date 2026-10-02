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

  async pollImageStatus(
    id: string,
    opts?: { maxAttempts?: number; intervalMs?: number },
  ) {
    const max = opts?.maxAttempts ?? 60;
    const intervalMs = opts?.intervalMs ?? 5000;

    for (let attempt = 1; attempt <= max; attempt++) {
      const data = await this.request<{
        success: boolean;
        data: {
          status: string;
          outputUrl?: string | null;
          error?: string | null;
        };
      }>("GET", `/image/status/${id}`);

      const status = data.data?.status;
      if (status === "COMPLETED" || status === "FAILED") {
        return { ...data, attempts: attempt };
      }

      if (attempt < max) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `Image job ${id} did not finish after ${max} poll attempts`,
    );
  }

  async pollMusicStatus(
    id: string,
    opts?: { maxAttempts?: number; intervalMs?: number },
  ) {
    const max = opts?.maxAttempts ?? 120;
    const intervalMs = opts?.intervalMs ?? 5000;

    for (let attempt = 1; attempt <= max; attempt++) {
      const data = await this.request<{
        success: boolean;
        data: {
          status: string;
          outputUrl?: string | null;
          error?: string | null;
        };
      }>("GET", `/music/status/${id}`);

      const status = data.data?.status;
      if (status === "COMPLETED" || status === "FAILED") {
        return { ...data, attempts: attempt };
      }

      if (attempt < max) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `Music job ${id} did not finish after ${max} poll attempts`,
    );
  }

  async pollVoiceoverStatus(
    id: string,
    opts?: { maxAttempts?: number; intervalMs?: number },
  ) {
    const max = opts?.maxAttempts ?? 60;
    const intervalMs = opts?.intervalMs ?? 5000;

    for (let attempt = 1; attempt <= max; attempt++) {
      const data = await this.request<{
        success: boolean;
        data: {
          status: string;
          outputUrl?: string | null;
          error?: string | null;
        };
      }>("GET", `/voiceovers/status/${id}`);

      const status = data.data?.status;
      if (status === "COMPLETED" || status === "FAILED") {
        return { ...data, attempts: attempt };
      }

      if (attempt < max) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `Voiceover job ${id} did not finish after ${max} poll attempts`,
    );
  }

  async pollClippingStatus(
    id: string,
    opts?: { maxAttempts?: number; intervalMs?: number },
  ) {
    const max = opts?.maxAttempts ?? 120;
    const intervalMs = opts?.intervalMs ?? 5000;

    for (let attempt = 1; attempt <= max; attempt++) {
      const data = await this.request<{
        success: boolean;
        data: { status: string; clips?: unknown[] };
      }>("GET", `/clippings/refresh/${id}`);

      const status = data.data?.status;
      if (status === "COMPLETED" || status === "FAILED") {
        return { ...data, attempts: attempt };
      }

      if (attempt < max) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `Clipping job ${id} did not finish after ${max} poll attempts`,
    );
  }

  async pollVideoStatus(
    id: string,
    opts?: { maxAttempts?: number; intervalMs?: number },
  ) {
    const max = opts?.maxAttempts ?? 120;
    const intervalMs = opts?.intervalMs ?? 5000;

    for (let attempt = 1; attempt <= max; attempt++) {
      const data = await this.request<{
        success: boolean;
        data: {
          status: string;
          outputUrl?: string | null;
          error?: string | null;
        };
      }>("GET", `/video/status/${id}`);

      const status = data.data?.status;
      if (status === "COMPLETED" || status === "FAILED") {
        return { ...data, attempts: attempt };
      }

      if (attempt < max) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `Video job ${id} did not finish after ${max} poll attempts`,
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
