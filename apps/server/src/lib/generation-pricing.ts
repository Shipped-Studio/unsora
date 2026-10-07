/**
 * Live generation pricing.
 *
 * Every catalog generation is priced by WaveSpeed's own pricing API
 * (`POST /api/v3/model/price`) for the exact payload we're about to submit,
 * so resolution, duration, audio and even the length of attached reference
 * videos are all reflected. The USD cost is then turned into credits with a
 * single margin:
 *
 *   credits = ceil(costUsd × (1 + GENERATION_MARGIN) / CREDIT_USD_VALUE)
 *
 * margin     default 0.20 — 20% on top of what WaveSpeed bills us.
 * creditUsd  default 0.028 — the dollars a credit is costed at. Keep it at
 *   or below the cheapest credit sold (after Stripe fees) or that plan's
 *   margin shrinks.
 *
 * Both are edited at /admin/pricing (app_settings `pricing.generation`);
 * until saved there they come from GENERATION_MARGIN / CREDIT_USD_VALUE.
 */

import { getSetting, setSetting } from "./app-settings";
import { wavespeedApiKey } from "./wavespeed-api";

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const QUOTE_TTL_MS = 2 * 60 * 1000;
const QUOTE_CACHE_MAX = 1000;

const DEFAULT_MARGIN = 0.2;
const DEFAULT_CREDIT_USD = 0.028;

const PRICING_SETTING = "pricing.generation";

function readNumberEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface PricingConfig {
  margin: number;
  creditUsd: number;
  /** Where the values come from: saved at /admin/pricing, or env/defaults. */
  source: "admin" | "env";
}

export function validPricing(v: unknown): v is { margin: number; creditUsd: number } {
  const p = v as { margin?: unknown; creditUsd?: unknown } | null;
  return (
    typeof p?.margin === "number" &&
    Number.isFinite(p.margin) &&
    p.margin >= 0 &&
    p.margin <= 10 &&
    typeof p.creditUsd === "number" &&
    Number.isFinite(p.creditUsd) &&
    p.creditUsd >= 0.0001 &&
    p.creditUsd <= 10
  );
}

export async function pricingConfig(): Promise<PricingConfig> {
  const saved = await getSetting<unknown>(PRICING_SETTING);
  if (validPricing(saved)) {
    return { margin: saved.margin, creditUsd: saved.creditUsd, source: "admin" };
  }
  return {
    margin: readNumberEnv("GENERATION_MARGIN", DEFAULT_MARGIN),
    creditUsd: readNumberEnv("CREDIT_USD_VALUE", DEFAULT_CREDIT_USD),
    source: "env",
  };
}

export async function savePricingConfig(
  value: { margin: number; creditUsd: number },
  updatedBy?: string,
): Promise<void> {
  await setSetting(
    PRICING_SETTING,
    { margin: value.margin, creditUsd: value.creditUsd },
    updatedBy,
  );
}

/** USD cost → credits charged to the user (always at least 1). */
export async function usdToCredits(costUsd: number): Promise<number> {
  const { margin, creditUsd } = await pricingConfig();
  // The epsilon keeps float noise (0.1 × 3) from rounding up a whole credit.
  return Math.max(1, Math.ceil((costUsd * (1 + margin)) / creditUsd - 1e-9));
}

export interface GenerationQuote {
  credits: number;
  /** What WaveSpeed charges us after our account discount. */
  costUsd: number;
  /** WaveSpeed list price before discount. */
  listUsd: number;
}

export class PricingError extends Error {
  constructor(
    message: string,
    /** HTTP status to send the client: 400 for unreadable media, 502 otherwise. */
    public readonly status: number,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

// WaveSpeed business codes for price failures.
const MEDIA_ERRORS: Record<number, string> = {
  4006: "Couldn't read the length of an attached video or audio file",
  4007: "Couldn't read the size of an attached image",
};

// Caches WaveSpeed's cost only; credits are worked out on every read so a
// margin change at /admin/pricing applies straight away.
const quoteCache = new Map<
  string,
  { at: number; cost: Omit<GenerationQuote, "credits"> }
>();

function cacheKey(modelId: string, inputs: Record<string, unknown>) {
  const sorted = Object.keys(inputs)
    .sort()
    .map((k) => [k, inputs[k]]);
  return `${modelId}\n${JSON.stringify(sorted)}`;
}

/**
 * Price one run of `modelId` with exactly these inputs. Quotes are cached for
 * two minutes, the same window WaveSpeed caches media measurements for.
 */
export async function quoteGeneration(
  modelId: string,
  inputs: Record<string, unknown>,
): Promise<GenerationQuote> {
  const key = cacheKey(modelId, inputs);
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) {
    return { ...hit.cost, credits: await usdToCredits(hit.cost.costUsd) };
  }

  const apiKey = wavespeedApiKey();
  if (!apiKey) {
    console.error("[pricing] WAVESPEED_API_KEY is not configured");
    throw new PricingError("Generation is temporarily unavailable. Try again later.", 503);
  }

  let res: Response;
  try {
    res = await fetch(`${WAVESPEED_BASE}/model/price`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model_id: modelId, inputs }),
      // Media measurement can take a while; anything longer is a hang.
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new PricingError("Couldn't reach the pricing service. Try again.", 502);
  }

  const body = (await res.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
    data?: { price?: number; discounted_price?: number };
  };

  if (!res.ok || body.code !== 200 || !body.data) {
    const mediaError = body.code ? MEDIA_ERRORS[body.code] : undefined;
    if (mediaError) throw new PricingError(mediaError, 400);
    console.error(
      `[pricing] ${modelId} failed — HTTP ${res.status}:`,
      body.message ?? body,
    );
    if (res.status === 401) {
      console.error("[pricing] WAVESPEED_API_KEY is invalid or revoked on this deployment");
      throw new PricingError(
        "Generation is temporarily unavailable. Try again later.",
        503,
      );
    }
    throw new PricingError("Couldn't price this generation. Try again.", 502);
  }

  const listUsd = Number(body.data.price ?? 0);
  const discounted = Number(body.data.discounted_price ?? 0);
  // discounted_price is what the account is billed; fall back to list price if
  // it's missing so we never undercharge.
  const costUsd = discounted > 0 ? discounted : listUsd;
  if (!(costUsd > 0)) {
    throw new PricingError("Couldn't price this generation. Try again.", 502);
  }

  const quote = { credits: await usdToCredits(costUsd), costUsd, listUsd };

  if (quoteCache.size >= QUOTE_CACHE_MAX) {
    const oldest = quoteCache.keys().next().value;
    if (oldest !== undefined) quoteCache.delete(oldest);
  }
  quoteCache.set(key, { at: Date.now(), cost: { costUsd, listUsd } });
  return quote;
}
