import { wavespeedApiKey } from "./wavespeed-api";
import {
  CATALOG,
  findCatalogModel,
  type CatalogCategory,
  type CatalogEndpoint,
  type CatalogMode,
  type CatalogModel,
} from "../config/catalog";

/**
 * Live WaveSpeed model schemas, and the bridge between them and the app.
 *
 * `GET /api/v3/models` returns every model with its request schema (enums,
 * ranges, defaults, required fields). We fetch it once an hour and derive
 * the composer controls from it, so each model keeps WaveSpeed's own field
 * names and limits and never drifts from what the API accepts.
 */

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const SCHEMA_TTL_MS = 60 * 60 * 1000;

interface SchemaProperty {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
  items?: { type?: string };
  disabled?: boolean;
  description?: string;
}

export interface RequestSchema {
  properties: Record<string, SchemaProperty>;
  required?: string[];
  "x-order-properties"?: string[];
}

interface LiveModel {
  model_id: string;
  base_price: number;
  api_schema?: {
    api_schemas?: { type?: string; request_schema?: RequestSchema }[];
  };
}

/**
 * WaveSpeed itself is unusable (bad API key, outage). Nothing the caller sent
 * is wrong, so it maps to a 503 with a generic message; the cause is logged.
 */
export class ProviderUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "ProviderUnavailableError";
  }
}

// ─── Live schema cache ─────────────────────────────────────────────────────

let schemaCache: { at: number; byId: Map<string, RequestSchema> } | null = null;
let inflight: Promise<Map<string, RequestSchema>> | null = null;

async function fetchSchemas(): Promise<Map<string, RequestSchema>> {
  const apiKey = wavespeedApiKey();
  if (!apiKey) throw new ProviderUnavailableError("WAVESPEED_API_KEY is not configured");

  const res = await fetch(`${WAVESPEED_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const hint =
      res.status === 401
        ? " — WAVESPEED_API_KEY is invalid or revoked; set a valid key on this deployment"
        : "";
    throw new ProviderUnavailableError(
      `WaveSpeed model list failed — HTTP ${res.status}${hint}`,
    );
  }
  const body = (await res.json()) as { data?: LiveModel[] };

  const byId = new Map<string, RequestSchema>();
  for (const model of body.data ?? []) {
    const run = model.api_schema?.api_schemas?.find(
      (s) => s.type === "model_run",
    );
    if (run?.request_schema?.properties) {
      byId.set(model.model_id, run.request_schema);
    }
  }
  return byId;
}

function refreshSchemas(): Promise<Map<string, RequestSchema>> {
  inflight ??= fetchSchemas()
    .then((byId) => {
      schemaCache = { at: Date.now(), byId };
      return byId;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Every WaveSpeed request schema, keyed by model id. Refreshed hourly in the
 * background: once a copy exists, requests never wait on WaveSpeed, and a
 * failed refresh keeps serving the previous copy.
 */
export async function getLiveSchemas(): Promise<Map<string, RequestSchema>> {
  if (!schemaCache) return refreshSchemas();
  if (Date.now() - schemaCache.at >= SCHEMA_TTL_MS) {
    refreshSchemas().catch((err) =>
      console.warn("[wavespeed-catalog] refresh failed, serving stale:", err),
    );
  }
  return schemaCache.byId;
}

// ─── Fields: schema → composer controls ────────────────────────────────────

export type MediaKind = "image" | "video" | "audio";

export type FieldType =
  | "prompt"
  | "negative_prompt"
  | "media"
  | "select"
  | "aspect"
  | "duration"
  | "toggle";

export interface FieldOption {
  value: string;
  label: string;
}

/** One composer control. Values travel as strings; the server casts them back. */
export interface CatalogField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: FieldOption[];
  default?: string;
  /** Toggle only: chip text when off. */
  offLabel?: string;
  media?: { kind: MediaKind; max: number };
}

/** Never shown: transport flags and expert knobs with safe defaults. */
const ALWAYS_HIDDEN = new Set([
  "enable_sync_mode",
  "enable_base64_output",
]);

/** Settings shown as toolbar controls. Anything else keeps WaveSpeed's default. */
const SETTING_KEYS = new Set([
  "aspect_ratio",
  "size",
  "resolution",
  "duration",
  "quality",
  "generate_audio",
  "sound",
  "keep_original_sound",
  "character_orientation",
]);

const MEDIA_KEYS = new Set([
  "image",
  "images",
  "last_image",
  "end_image",
  "video",
  "videos",
  "audio",
  "audios",
  "reference_images",
  "reference_videos",
  "reference_audios",
]);

const LABELS: Record<string, string> = {
  prompt: "Prompt",
  negative_prompt: "Negative prompt",
  aspect_ratio: "Aspect ratio",
  size: "Size",
  resolution: "Resolution",
  duration: "Duration",
  quality: "Quality",
  generate_audio: "Audio",
  sound: "Audio",
  keep_original_sound: "Original audio",
  character_orientation: "Orientation",
  image: "Image",
  images: "Images",
  last_image: "Last frame",
  end_image: "End frame",
  video: "Video",
  videos: "Videos",
  audio: "Audio",
  audios: "Audio",
  reference_images: "Images",
  reference_videos: "Videos",
  reference_audios: "Audio",
};

const OFF_LABELS: Record<string, string> = {
  generate_audio: "No audio",
  sound: "No audio",
  keep_original_sound: "Original audio off",
};

const QUALITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

const ORIENTATION_LABELS: Record<string, string> = {
  image: "Orientation from image",
  video: "Orientation from video",
};

function mediaKind(key: string): MediaKind {
  if (key.includes("video")) return "video";
  if (key.includes("audio")) return "audio";
  return "image";
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "1280*720" → "16:9 · 720p". */
function sizeLabel(size: string): string {
  const [w, h] = size.split("*").map(Number);
  if (!w || !h) return size;
  const d = gcd(w, h);
  return `${w / d}:${h / d} · ${Math.min(w, h)}p`;
}

function optionLabel(key: string, value: string): string {
  if (key === "duration") return `${value}s`;
  if (key === "size") return sizeLabel(value);
  if (key === "quality") return QUALITY_LABELS[value] ?? value;
  if (key === "character_orientation") return ORIENTATION_LABELS[value] ?? value;
  if (/^\d+(\.\d+)?k$/i.test(value)) return value.toUpperCase();
  return value;
}

function durationOptions(prop: SchemaProperty): FieldOption[] {
  let values: number[];
  if (prop.enum?.length) {
    values = prop.enum.map(Number).filter(Number.isFinite);
  } else {
    const min = Math.ceil(prop.minimum ?? 1);
    const max = Math.floor(prop.maximum ?? min);
    values = [];
    for (let v = min; v <= max; v++) values.push(v);
  }
  return [...new Set(values)]
    .sort((a, b) => a - b)
    .map((v) => ({ value: String(v), label: `${v}s` }));
}

/**
 * Whether a schema field is user-settable: the prompt, media, the settings
 * above, and any required enum. Everything else keeps WaveSpeed's default,
 * both in the composer and in what the API accepts.
 */
function isExposed(key: string, prop: SchemaProperty, required: Set<string>) {
  return (
    key === "prompt" ||
    key === "negative_prompt" ||
    MEDIA_KEYS.has(key) ||
    SETTING_KEYS.has(key) ||
    (required.has(key) && !!prop.enum?.length)
  );
}

/**
 * Some text endpoints (Kling) don't mark the prompt required, but fail
 * without one. Treat it as required unless the endpoint runs from required
 * media instead (motion control, image-to-video).
 */
function promptRequired(schema: RequestSchema): boolean {
  const required = schema.required ?? [];
  return (
    required.includes("prompt") || !required.some((k) => MEDIA_KEYS.has(k))
  );
}

function isHidden(model: CatalogModel, key: string, prop: SchemaProperty) {
  return (
    prop.disabled === true ||
    ALWAYS_HIDDEN.has(key) ||
    (model.hide?.includes(key) ?? false)
  );
}

/** Build the composer fields for one endpoint, in WaveSpeed's own order. */
export function buildFields(
  model: CatalogModel,
  mode: CatalogMode,
  schema: RequestSchema,
): CatalogField[] {
  const required = new Set(schema.required ?? []);
  const order = schema["x-order-properties"] ?? [];
  const keys = [
    ...order.filter((k) => k in schema.properties),
    ...Object.keys(schema.properties).filter((k) => !order.includes(k)),
  ];

  const fields: CatalogField[] = [];
  for (const key of keys) {
    const prop = schema.properties[key];
    if (isHidden(model, key, prop) || !isExposed(key, prop, required)) continue;

    const label = mode.labels?.[key] ?? LABELS[key] ?? key;
    const isRequired = required.has(key);
    const override = model.defaults?.[key];

    if (key === "prompt" || key === "negative_prompt") {
      fields.push({
        key,
        label,
        type: key,
        required: key === "prompt" ? promptRequired(schema) : isRequired,
      });
      continue;
    }

    if (MEDIA_KEYS.has(key)) {
      const isArray = prop.type === "array";
      fields.push({
        key,
        label,
        type: "media",
        required: isRequired,
        media: {
          kind: mediaKind(key),
          max: isArray ? prop.maxItems ?? 10 : 1,
        },
      });
      continue;
    }

    if (prop.type === "boolean") {
      const def = override ?? prop.default ?? false;
      fields.push({
        key,
        label,
        type: "toggle",
        required: false,
        options: [
          { value: "true", label: "On" },
          { value: "false", label: "Off" },
        ],
        default: String(def === true),
        offLabel: OFF_LABELS[key],
      });
      continue;
    }

    if (key === "duration") {
      const options = durationOptions(prop);
      if (!options.length) continue;
      const def = String(override ?? prop.default ?? options[0].value);
      fields.push({
        key,
        label,
        type: "duration",
        required: isRequired,
        options,
        default: options.some((o) => o.value === def) ? def : options[0].value,
      });
      continue;
    }

    if (!prop.enum?.length) continue;

    const options: FieldOption[] = prop.enum.map((v) => ({
      value: String(v),
      label: optionLabel(key, String(v)),
    }));
    const hasDefault = (override ?? prop.default) !== undefined;
    // Optional enum without a default: offer "Auto" and leave the field out.
    if (!hasDefault && !isRequired) {
      options.unshift({ value: "auto", label: "Auto" });
    }
    const def = String(override ?? prop.default ?? options[0].value);

    fields.push({
      key,
      label,
      type: key === "aspect_ratio" || key === "size" ? "aspect" : "select",
      required: isRequired,
      options,
      default: options.some((o) => o.value === def) ? def : options[0].value,
    });
  }
  return fields;
}

// ─── Catalog DTO for the client ────────────────────────────────────────────

export interface CatalogEndpointDTO {
  modelId: string;
  when?: string[];
  fields: CatalogField[];
}

export interface CatalogModeDTO {
  key: string;
  label: string;
  endpoints: CatalogEndpointDTO[];
}

export interface CatalogModelDTO {
  key: string;
  label: string;
  provider: string;
  icon: string;
  category: CatalogCategory;
  description: string;
  isNew: boolean;
  legacyDbModels: string[];
  modes: CatalogModeDTO[];
}

/**
 * The catalog with live fields attached. Endpoints WaveSpeed no longer lists
 * are dropped, and so is any mode or model left with nothing to call.
 */
export async function getCatalog(
  category?: CatalogCategory,
): Promise<CatalogModelDTO[]> {
  const schemas = await getLiveSchemas();
  const models: CatalogModelDTO[] = [];

  for (const model of CATALOG) {
    if (category && model.category !== category) continue;

    const modes: CatalogModeDTO[] = [];
    for (const mode of model.modes) {
      const endpoints: CatalogEndpointDTO[] = [];
      for (const ep of mode.endpoints) {
        const schema = schemas.get(ep.modelId);
        if (!schema) continue;
        endpoints.push({
          modelId: ep.modelId,
          when: ep.when,
          fields: buildFields(model, mode, schema),
        });
      }
      if (endpoints.length) {
        modes.push({ key: mode.key, label: mode.label, endpoints });
      }
    }

    if (modes.length) {
      models.push({
        key: model.key,
        label: model.label,
        provider: model.provider,
        icon: model.icon,
        category: model.category,
        description: model.description,
        isNew: model.isNew ?? false,
        legacyDbModels: model.legacyDbModels ?? [],
        modes,
      });
    }
  }
  return models;
}

// ─── Legacy input adaptation ───────────────────────────────────────────────

/** "1280*720" → [16, 9]. */
function sizeRatio(size: string): [number, number] | null {
  const [w, h] = size.split("*").map(Number);
  if (!w || !h) return null;
  const d = gcd(w, h);
  return [w / d, h / d];
}

/**
 * Bend generic inputs (as the pre-catalog public API took them) onto a
 * model's real field names: reference images go to `images` on models that
 * call them that, the end frame goes to `last_image` or `end_image`, and an
 * aspect ratio becomes the smallest matching `size` on models that only take
 * a size (Sora).
 */
export async function adaptLegacyInputs(
  modelKey: string,
  inputs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const model = findCatalogModel(modelKey);
  if (!model) return inputs;
  const schemas = await getLiveSchemas();
  const props = model.modes
    .flatMap((m) => m.endpoints)
    .map((ep) => schemas.get(ep.modelId)?.properties ?? {});
  const has = (key: string) => props.some((p) => key in p);
  const out = { ...inputs };

  if (out.reference_images && !has("reference_images") && has("images")) {
    out.images = out.reference_images;
    delete out.reference_images;
  }

  // End frame: Kling calls it end_image, everyone else last_image.
  if (out.last_image !== undefined && out.end_image !== undefined) {
    delete out[has("end_image") && !has("last_image") ? "last_image" : "end_image"];
  }

  if (typeof out.aspect_ratio === "string" && !has("aspect_ratio") && has("size")) {
    const [rw, rh] = out.aspect_ratio.split(":").map(Number);
    const sizes = props
      .flatMap((p) => (p.size?.enum ?? []).map(String))
      .map((size) => ({ size, ratio: sizeRatio(size) }))
      .filter((s) => s.ratio && s.ratio[0] === rw && s.ratio[1] === rh)
      .sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }));
    if (sizes.length) out.size = sizes[0].size;
    delete out.aspect_ratio;
  }
  return out;
}

// ─── Request resolution + validation ───────────────────────────────────────

export class CatalogInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogInputError";
  }
}

function hasMedia(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((v) => typeof v === "string" && v);
  return typeof value === "string" && value.length > 0;
}

/** Media field keys in `inputs` that carry at least one file. */
function attachedMediaKeys(inputs: Record<string, unknown>): string[] {
  return Object.keys(inputs).filter(
    (k) => MEDIA_KEYS.has(k) && hasMedia(inputs[k]),
  );
}

/** Every media URL in `inputs`, for importing outside files. */
export function mediaUrls(inputs: Record<string, unknown>): string[] {
  return attachedMediaKeys(inputs).flatMap((k) => {
    const v = inputs[k];
    return (Array.isArray(v) ? v : [v]).filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
  });
}

/**
 * The mode to use when the caller didn't name one: the first mode that takes
 * every attached file (a start frame picks "first and last frame", reference
 * videos pick "omni reference").
 */
function pickMode(
  model: CatalogModel,
  inputs: Record<string, unknown>,
  schemas: Map<string, RequestSchema>,
): CatalogMode {
  const attached = attachedMediaKeys(inputs);
  return (
    model.modes.find((mode) =>
      attached.every((key) =>
        mode.endpoints.some((ep) => schemas.get(ep.modelId)?.properties[key]),
      ),
    ) ?? model.modes[0]
  );
}

/** First endpoint in the mode whose `when` media fields all have files. */
export function resolveEndpoint(
  mode: CatalogMode,
  inputs: Record<string, unknown>,
): CatalogEndpoint {
  const match = mode.endpoints.find((ep) =>
    (ep.when ?? []).every((key) => hasMedia(inputs[key])),
  );
  return match ?? mode.endpoints[mode.endpoints.length - 1];
}

export interface ResolvedRequest {
  model: CatalogModel;
  mode: CatalogMode;
  modelId: string;
  /** Payload in WaveSpeed's own field names, ready to submit as-is. */
  inputs: Record<string, unknown>;
  /** Required inputs still missing (the request can't run yet). */
  missing: string[];
  /** The subset of `missing` that is media, which can change the price. */
  missingMedia: string[];
}

/** Hosts our uploads and library files are served from. */
function mediaHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const name of ["SUPABASE_URL", "MEDIA_CDN_BASE", "MEDIA_STORAGE_BASE"]) {
    const value = process.env[name];
    if (!value) continue;
    try {
      hosts.add(new URL(value).host);
    } catch {
      // Not a URL; ignore.
    }
  }
  return hosts;
}

/**
 * Media must come from our own storage. Prices for video and audio inputs
 * depend on their length, and WaveSpeed fetches the file once to price it and
 * again to generate, so a URL we don't control could serve a short clip to
 * the price check and a long one to the job.
 */
export function isOwnMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && mediaHosts().has(url.host);
  } catch {
    return false;
  }
}

function castEnum(prop: SchemaProperty, raw: unknown): unknown {
  const match = prop.enum!.find((v) => String(v) === String(raw));
  return match;
}

function castNumber(
  key: string,
  prop: SchemaProperty,
  raw: unknown,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new CatalogInputError(`${key} must be a number`);
  if (prop.type === "integer" && !Number.isInteger(n)) {
    throw new CatalogInputError(`${key} must be a whole number`);
  }
  if (prop.minimum !== undefined && n < prop.minimum) {
    throw new CatalogInputError(`${key} must be at least ${prop.minimum}`);
  }
  if (prop.maximum !== undefined && n > prop.maximum) {
    throw new CatalogInputError(`${key} must be at most ${prop.maximum}`);
  }
  return n;
}

/**
 * Validate client inputs against the endpoint's live schema and return the
 * exact WaveSpeed payload. Fields the composer doesn't expose are dropped, values are
 * cast to the schema's types, and enums/ranges/limits are enforced.
 *
 * `strict: false` (price previews) skips the required-field check so a quote
 * can show before every file is attached.
 */
export async function resolveRequest(params: {
  modelKey: string;
  modeKey?: string;
  inputs: Record<string, unknown>;
  strict: boolean;
  /**
   * Accept media hosted anywhere (price previews only). Generations must use
   * our own storage, so the controller imports outside files first.
   */
  allowExternalMedia?: boolean;
}): Promise<ResolvedRequest> {
  const model = findCatalogModel(params.modelKey);
  if (!model) {
    throw new CatalogInputError(
      `Unknown model: ${params.modelKey}. List models with GET /catalog (MCP: list_models).`,
    );
  }

  const schemas = await getLiveSchemas();
  const mode = params.modeKey
    ? model.modes.find((m) => m.key === params.modeKey)
    : pickMode(model, params.inputs, schemas);
  if (!mode) {
    throw new CatalogInputError(
      `Unknown mode "${params.modeKey}" for ${model.label}. Modes: ${model.modes
        .map((m) => m.key)
        .join(", ")}`,
    );
  }

  const endpoint = resolveEndpoint(mode, params.inputs);
  const schema = schemas.get(endpoint.modelId);
  if (!schema) {
    throw new CatalogInputError(`${model.label} is not available right now`);
  }

  const required = new Set(schema.required ?? []);
  const acceptUrl = (value: unknown): value is string =>
    params.allowExternalMedia
      ? typeof value === "string" && /^https?:\/\/\S+$/i.test(value)
      : isOwnMediaUrl(value);
  const inputs: Record<string, unknown> = {};
  const missing: string[] = [];
  const missingMedia: string[] = [];
  const fieldLabel = (key: string) => mode.labels?.[key] ?? LABELS[key] ?? key;

  for (const [key, prop] of Object.entries(schema.properties)) {
    if (isHidden(model, key, prop) || !isExposed(key, prop, required)) continue;

    let raw = params.inputs[key];
    if (raw === undefined || raw === null || raw === "") {
      raw = model.defaults?.[key];
    }

    if (key === "prompt" || key === "negative_prompt") {
      const text = typeof raw === "string" ? raw.trim() : "";
      const isRequired =
        key === "prompt" ? promptRequired(schema) : required.has(key);
      if (text) inputs[key] = text;
      else if (isRequired) missing.push(fieldLabel(key));
      continue;
    }

    if (MEDIA_KEYS.has(key)) {
      if (prop.type === "array") {
        const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
          (v) => v !== "" && v !== null && v !== undefined,
        );
        if (!list.every(acceptUrl)) {
          throw new CatalogInputError(
            `${fieldLabel(key)} must be files uploaded to Unsora`,
          );
        }
        const max = prop.maxItems ?? Infinity;
        if (list.length > max) {
          throw new CatalogInputError(
            `${fieldLabel(key)}: up to ${max} files`,
          );
        }
        if (list.length) inputs[key] = list;
        else if (required.has(key)) missingMedia.push(fieldLabel(key));
      } else {
        const url = Array.isArray(raw) ? raw[0] : raw;
        if (url) {
          if (!acceptUrl(url)) {
            throw new CatalogInputError(
              `${fieldLabel(key)} must be a file uploaded to Unsora`,
            );
          }
          inputs[key] = url;
        } else if (required.has(key)) {
          missingMedia.push(fieldLabel(key));
        }
      }
      continue;
    }

    const autoPlaceholder = raw === "auto" && !prop.enum?.includes("auto");
    if (raw === undefined || raw === null || raw === "" || autoPlaceholder) {
      continue; // WaveSpeed applies its schema default.
    }

    if (prop.enum?.length) {
      const value = castEnum(prop, raw);
      if (value === undefined) {
        throw new CatalogInputError(
          `${fieldLabel(key)} must be one of: ${prop.enum.join(", ")}`,
        );
      }
      inputs[key] = value;
    } else if (prop.type === "boolean") {
      inputs[key] = raw === true || raw === "true";
    } else if (prop.type === "integer" || prop.type === "number") {
      inputs[key] = castNumber(fieldLabel(key), prop, raw);
    } else if (prop.type === "string" && typeof raw === "string") {
      inputs[key] = raw;
    }
  }

  missing.push(...missingMedia);
  if (params.strict && missing.length) {
    throw new CatalogInputError(
      `Add ${missing.map((l) => l.toLowerCase()).join(" and ")} to continue`,
    );
  }

  // A file attached to a field this endpoint doesn't take (an end frame with
  // no start frame) would be dropped silently, so name what it needs instead.
  if (params.strict) {
    for (const [key, value] of Object.entries(params.inputs)) {
      if (!MEDIA_KEYS.has(key) || key in schema.properties || !hasMedia(value)) {
        continue;
      }
      const needs =
        mode.endpoints.find((ep) => schemas.get(ep.modelId)?.properties[key])
          ?.when ?? [];
      throw new CatalogInputError(
        needs.length
          ? `Add ${needs.map(fieldLabel).join(" and ")} to use ${fieldLabel(key)}`
          : `${fieldLabel(key)} isn't used in this mode`,
      );
    }
  }

  return {
    model,
    mode,
    modelId: endpoint.modelId,
    inputs,
    missing,
    missingMedia,
  };
}
