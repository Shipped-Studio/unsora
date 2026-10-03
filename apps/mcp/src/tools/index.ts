import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
interface ResourceUiMeta {
  csp?: { resourceDomains?: string[]; connectDomains?: string[] };
  domain?: string;
}
import { z } from "zod";
import { type UnsoraApi, UnsoraApiError } from "../unsora-api.js";
import type { UnsoraAuthResolver } from "../server.js";
import { jsonResult } from "../util.js";

const IMAGE_UI_URI = "ui://unsora/image";
const VIDEO_UI_URI = "ui://unsora/video";
const AUDIO_UI_URI = "ui://unsora/audio";
const CLIPPING_UI_URI = "ui://unsora/clipping";
const VOICES_UI_URI = "ui://unsora/voices";
const ACCOUNT_UI_URI = "ui://unsora/account";
const ACCOUNTS_UI_URI = "ui://unsora/accounts";
const POSTS_UI_URI = "ui://unsora/posts";
const ANALYTICS_UI_URI = "ui://unsora/analytics";
const LIBRARY_UI_URI = "ui://unsora/library";
const COMPOSER_UI_URI = "ui://unsora/composer";

/**
 * Widgets built on the shared kit (assets/mcp-ui/shared). Each reads the
 * structuredContent of the tools bound to it (see `_meta.ui.resourceUri`)
 * and calls tools itself for follow-up actions.
 */
const KIT_WIDGETS = [
  { uri: ACCOUNT_UI_URI, file: "account-view.html", name: "Unsora Plan & Credits", description: "Plan, subscription and credit balance" },
  { uri: ACCOUNTS_UI_URI, file: "accounts-view.html", name: "Unsora Connected Accounts", description: "Connected social accounts" },
  { uri: POSTS_UI_URI, file: "posts-view.html", name: "Unsora Posts", description: "Scheduled, draft and published posts with live publish status" },
  { uri: ANALYTICS_UI_URI, file: "analytics-view.html", name: "Unsora Analytics", description: "Post performance across platforms" },
  { uri: LIBRARY_UI_URI, file: "library-view.html", name: "Unsora Library", description: "Past generations and uploads" },
  { uri: COMPOSER_UI_URI, file: "composer-view.html", name: "Unsora Post Composer", description: "Compose, configure per platform and schedule a post" },
] as const;

/** Appended to descriptions of tools whose result renders a widget. */
const SHOWN_IN_UI =
  " In app-capable hosts the result renders as an interactive panel the user can see and act " +
  "on — do NOT repeat its contents as a list or table in your reply; add only what the panel " +
  "doesn't say.";

/*
 * Media preview contract (assets/mcp-ui/media-view.html reads this):
 *   - a create tool with a preview returns structuredContent
 *     { …the result, generationIds, tool, kind, mcpTool, status, aspectRatio? }
 *     where `tool` is the generation kind below and `mcpTool` the create tool
 *     (called again for Recreate);
 *   - the widget polls image_status / video_status / audio_status (app-only,
 *     hidden from the model) with { tool, id } and reads
 *     { id, tool, kind, status, url, error, title, text }, status lowercase.
 */
type PreviewKind = "image" | "video" | "audio";

const PREVIEWS: Record<
  PreviewKind,
  { uri: string; name: string; statusTool: string }
> = {
  image: {
    uri: IMAGE_UI_URI,
    name: "Unsora Image Preview",
    statusTool: "image_status",
  },
  video: {
    uri: VIDEO_UI_URI,
    name: "Unsora Video Preview",
    statusTool: "video_status",
  },
  audio: {
    uri: AUDIO_UI_URI,
    name: "Unsora Audio Preview",
    statusTool: "audio_status",
  },
};

const PREVIEW_KINDS = Object.keys(PREVIEWS) as PreviewKind[];

/**
 * Generation kinds a preview can poll: the widget that shows it, the v1
 * status endpoint, and the wait tool for hosts without the widget.
 */
const GENERATIONS = {
  image: { kind: "image", status: "/image/status", wait: "wait_for_image" },
  influencer: { kind: "image", status: "/image/status", wait: "wait_for_image" },
  thumbnail: { kind: "image", status: "/image/status", wait: "wait_for_image" },
  image_upscale: { kind: "image", status: "/image/status", wait: "wait_for_image" },
  movie_material: { kind: "image", status: "/image/status", wait: "wait_for_image" },
  video: { kind: "video", status: "/video/status", wait: "wait_for_video" },
  video_upscale: { kind: "video", status: "/video/status", wait: "wait_for_video" },
  watermark_removal: { kind: "video", status: "/video/status", wait: "wait_for_video" },
  motion_control: { kind: "video", status: "/video/status", wait: "wait_for_video" },
  avatar: { kind: "video", status: "/video/status", wait: "wait_for_video" },
  music: { kind: "audio", status: "/music/status", wait: "wait_for_music" },
  voiceover: { kind: "audio", status: "/voiceovers/status", wait: "wait_for_voiceover" },
  voice_change: { kind: "audio", status: "/voiceovers/status", wait: "wait_for_voiceover" },
} as const satisfies Record<
  string,
  { kind: PreviewKind; status: string; wait: string }
>;

type GenerationKind = keyof typeof GENERATIONS;

const GENERATION_KINDS = Object.keys(GENERATIONS) as [
  GenerationKind,
  ...GenerationKind[],
];

/** Hints for tools that only read (hosts may skip the approval prompt). */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** ElevenLabs Eleven v3 voices exposed by the public API (see /voiceovers/voices). */
const VOICEOVER_VOICES = [
  "Aria",
  "Roger",
  "Sarah",
  "Laura",
  "Charlie",
  "George",
  "Callum",
  "River",
  "Liam",
  "Charlotte",
  "Alice",
  "Matilda",
  "Will",
  "Jessica",
  "Eric",
  "Chris",
  "Brian",
  "Daniel",
  "Lily",
  "Bill",
] as const;

/** Mureka music models exposed by the public API (see docs music-generations/create). */
const MUSIC_MODELS = [
  "auto",
  "mureka-9",
  "mureka-8",
  "mureka-o2",
  "mureka-7.6",
  "mureka-7.5",
] as const;

/**
 * Friendly caption style presets, named by look. The server maps these to
 * Wayin template IDs (server/src/lib/caption-styles.ts).
 */
const CAPTION_STYLE_PRESETS = [
  "classic-yellow",
  "white-card",
  "black-box",
  "bold-white",
  "white-underline",
  "playful-green",
  "sketch-blue",
  "bubble-blue",
  "bubble-green",
  "glow-yellow",
  "duo-green",
  "duo-purple",
  "elegant-purple",
  "neon-cyan",
  "glow-pink",
  "bold-yellow",
  "soft-orange",
  "glow-green",
  "glow-orange",
  "retro-outline",
  "mint-bubble",
  "comic-duo",
  "static-outline",
  "static-comic",
  "static-minimal",
  "static-green",
  "static-yellow",
  "static-orange",
  "gaming-magenta",
  "gaming-green",
  "gaming-yellow",
  "gaming-white",
  "gaming-purple-box",
  "gaming-cyan",
  "gaming-orange-box",
] as const;

const CLIP_RATIOS = ["9:16", "1:1", "4:5", "16:9", "original"] as const;

/** Influencer studio look/lighting presets (mirror server influencerConfig.styleModes). */
const INFLUENCER_STYLE_MODES = [
  "ugc",
  "casual_daylight",
  "cozy_indoor",
  "low_light_intimate",
  "raw_flash",
  "golden_hour",
  "moody_night",
  "car_selfie",
  "mirror_selfie",
  "luxury_influencer",
  "cinematic",
  "travel_content",
  "beauty_closeup",
  "party_night_out",
] as const;

/** Delivery emotions (MiniMax preset voices and talking avatars). */
const VOICE_EMOTIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgusted",
  "surprised",
] as const;

/** Kling Motion Control models: tool key → server model id + its only resolution. */
const MOTION_CONTROL_MODELS = {
  "kling-3.0-pro": { id: "kling_mc_3.0_pro", resolution: "1080p" },
  "kling-3.0-std": { id: "kling_mc_3.0_std", resolution: "720p" },
  "kling-2.6-pro": { id: "kling_mc_2.6_pro", resolution: "1080p" },
} as const;

type MotionControlModel = keyof typeof MOTION_CONTROL_MODELS;

const MOTION_CONTROL_MODEL_KEYS = Object.keys(MOTION_CONTROL_MODELS) as [
  MotionControlModel,
  ...MotionControlModel[],
];

const VIDEO_UPSCALE_MODELS = ["standard", "ultra-1080p", "ultra-4k"] as const;

/**
 * Movie materials modes → the style params each accepts (mirrors the app's
 * prompt form). The app always sends every param, "auto" by default; the job
 * substitutes opinionated defaults for missing ones, so the tool does the same.
 */
const MOVIE_MATERIAL_PARAMS = {
  face: ["cinematography", "age", "gender"],
  "wide-body": ["cinematography"],
  sheet: ["cinematography"],
  location: ["cinematography"],
  "first-frame": ["cinematography", "camera-angle"],
  "style-collage": [
    "cinematography",
    "color-palette",
    "lighting-mood",
    "era-vibe",
  ],
  "multishot-2x4": ["cinematography"],
  "multishot-1x4": ["cinematography"],
} as const;

type MovieMaterialMode = keyof typeof MOVIE_MATERIAL_PARAMS;

const MOVIE_MATERIAL_MODES = Object.keys(MOVIE_MATERIAL_PARAMS) as [
  MovieMaterialMode,
  ...MovieMaterialMode[],
];

/**
 * The user's library per result type: list endpoint + item path prefix (for
 * delete). Mirrors the feature pages in the Unsora app.
 */
const LIBRARY = {
  image: { list: "/image-generations/all", item: "/image-generations" },
  video: { list: "/videos/all", item: "/videos" },
  music: { list: "/music-generations/all", item: "/music-generations" },
  voiceover: { list: "/voiceovers/all", item: "/voiceovers" },
  influencer: { list: "/influencer-studio/all", item: "/influencer-studio" },
  thumbnail: { list: "/thumbnails", item: "/thumbnails" },
  clipping: { list: "/clippings/all", item: "/clippings" },
  image_upscale: { list: "/image-upscaler/all", item: "/image-upscaler" },
  video_upscale: { list: "/video-upscaler/all", item: "/video-upscaler" },
  watermark_removal: {
    list: "/watermark-removal/all",
    item: "/watermark-removal",
  },
  motion_control: { list: "/motion-control/all", item: "/motion-control" },
  avatar: { list: "/avatar-generations/all", item: "/avatar-generations" },
  movie_material: { list: "/movie-materials/all", item: "/movie-materials" },
  voice_change: { list: "/voice-conversions/all", item: "/voice-conversions" },
} as const;

type LibraryType = keyof typeof LIBRARY;

const LIBRARY_TYPES = Object.keys(LIBRARY) as [LibraryType, ...LibraryType[]];

/** Hosts that may serve the generated media inside the sandboxed iframe. */
const MEDIA_DOMAINS = (
  process.env.MCP_MEDIA_DOMAINS || "https://*.blob.core.windows.net"
)
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

/** Stable per-server origin Claude uses for the app sandbox (RFC: SEP-1865). */
function claudeAppDomain(): string | undefined {
  const publicUrl = process.env.MCP_PUBLIC_URL;
  if (!publicUrl) return undefined;
  const resourceUrl = `${publicUrl}${process.env.MCP_PATH || "/mcp"}`;
  const hash = createHash("sha256")
    .update(resourceUrl)
    .digest("hex")
    .slice(0, 32);
  return `${hash}.claudemcpcontent.com`;
}

/** Where connected accounts' profile pictures are served from. */
const AVATAR_DOMAINS = [
  "https://*.fbcdn.net",
  "https://*.cdninstagram.com",
  "https://*.tiktokcdn.com",
  "https://*.tiktokcdn-us.com",
  "https://*.googleusercontent.com",
  "https://*.ggpht.com",
  "https://*.ytimg.com",
  "https://*.pinimg.com",
  "https://*.licdn.com",
  "https://cdn.bsky.app",
];

function resourceUiMeta(extraDomains: readonly string[] = []): ResourceUiMeta {
  const meta: ResourceUiMeta = {
    csp: { resourceDomains: [...MEDIA_DOMAINS, ...extraDomains] },
  };
  const domain = claudeAppDomain();
  if (domain) meta.domain = domain;
  return meta;
}

const widgetCache = new Map<string, string>();

/** A file from assets/mcp-ui. */
async function readWidgetAsset(file: string): Promise<string> {
  // dist/tools and src/tools (tsx) both sit two levels below assets/.
  const candidates = [
    fileURLToPath(new URL(`../../assets/mcp-ui/${file}`, import.meta.url)),
    fileURLToPath(new URL(`./assets/mcp-ui/${file}`, `file://${process.cwd()}/`)),
  ];
  let lastError: unknown;
  for (const path of candidates) {
    try {
      return await readFile(path, "utf-8");
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`MCP widget asset not found (assets/mcp-ui/${file}). ${String(lastError)}`);
}

/**
 * A widget from assets/mcp-ui (plain HTML/JS, no build step). Widgets that
 * use the shared kit mark where it goes with `/*@kit.css*\/` and
 * `/*@kit.js*\/`; the kit is inlined so each widget stays one document.
 */
async function loadWidget(file: string): Promise<string> {
  const cached = widgetCache.get(file);
  if (cached) return cached;

  let html = await readWidgetAsset(file);
  if (html.includes("/*@kit.")) {
    const [css, js] = await Promise.all([
      readWidgetAsset("shared/kit.css"),
      readWidgetAsset("shared/kit.js"),
    ]);
    const appUrl = (process.env.UNSORA_APP_URL || "https://app.tryunsora.com").replace(/\/+$/, "");
    html = html
      .split("/*@kit.css*/").join(css)
      .split("/*@kit.js*/").join(js)
      .split("__UNSORA_APP_URL__").join(JSON.stringify(appUrl).slice(1, -1));
  }
  widgetCache.set(file, html);
  return html;
}

/** The media preview widget with its kind filled in. */
async function widgetHtml(kind: PreviewKind): Promise<string> {
  return (await loadWidget("media-view.html")).split("__UNSORA_KIND__").join(kind);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { result: value };
}

/** A tool result whose structuredContent the preview widget reads. */
function structuredResult(
  data: unknown,
  structured: Record<string, unknown>,
  opts: { isError?: boolean; prefix?: string } = {},
) {
  return {
    content: [
      { type: "text" as const, text: `${opts.prefix ?? ""}${JSON.stringify(data)}` },
    ],
    structuredContent: structured,
    ...(opts.isError ? { isError: true } : {}),
  };
}

/**
 * One status check for the preview widget. A job that doesn't exist (4xx) is
 * an error result, so the widget stops; a transient failure returns no status,
 * so the widget keeps polling.
 */
async function checkGenerationStatus(
  unsora: UnsoraApi,
  kind: PreviewKind,
  tool: GenerationKind,
  id: string,
) {
  let payload: unknown;
  try {
    payload = await unsora.request(
      "GET",
      `${GENERATIONS[tool].status}/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof UnsoraApiError && error.status < 500) {
      return structuredResult(
        { code: "not_found", error: message },
        { code: "not_found", error: `No ${tool} generation with id ${id}.` },
        { isError: true },
      );
    }
    return structuredResult(
      { code: "unavailable", error: message },
      { id, tool, kind, error: message },
    );
  }

  const data = asObject(asObject(payload).data ?? payload);
  const status = typeof data.status === "string" ? data.status.toLowerCase() : "queued";
  return structuredResult(payload, {
    id,
    tool,
    kind,
    status,
    url: typeof data.outputUrl === "string" ? data.outputUrl : null,
    error: typeof data.error === "string" ? data.error : null,
    title: typeof data.title === "string" ? data.title : null,
    text: null,
  });
}

/**
 * One clipping status check for the preview widget (same rules as media):
 * { id, tool, kind, status, clips, error }, clips as they finish.
 */
async function checkClippingStatus(unsora: UnsoraApi, id: string) {
  const base = { id, tool: "clipping", kind: "clipping" };
  let payload: unknown;
  try {
    payload = await unsora.request(
      "GET",
      `/clippings/refresh/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof UnsoraApiError && error.status < 500) {
      return structuredResult(
        { code: "not_found", error: message },
        { code: "not_found", error: `No clipping job with id ${id}.` },
        { isError: true },
      );
    }
    return structuredResult({ code: "unavailable", error: message }, { ...base, error: message });
  }

  const { status, clips } = readClips(payload);
  const data = asObject(asObject(payload).data ?? payload);
  return structuredResult(payload, {
    ...base,
    status: status ? status.toLowerCase() : "queued",
    clips,
    error: typeof data.error === "string" ? data.error : null,
  });
}

/** Told to the model on a create result, where a preview may be showing. */
function previewNote(wait: string): string {
  return (
    "Generation queued. If this host rendered the Unsora preview panel, it polls progress " +
    `and shows the result itself: do NOT call ${wait}, summarize the settings used and ` +
    `end your turn. In hosts without the preview, call ${wait} with the generation id — ` +
    "also when a next step needs the output URL (posting it, or passing it to another tool)."
  );
}

/**
 * Pull generation id(s) from a create response. Image/video return a single
 * `generation.id`; thumbnail/influencer return a `generations: [{id}]` array.
 */
interface ClipData {
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
}

/** Normalize a clipping refresh response into status + flat clip list. */
function readClips(payload: unknown): { status?: string; clips: ClipData[] } {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const status = typeof data.status === "string" ? data.status : undefined;
  const raw = Array.isArray(data.clips) ? data.clips : [];

  const clips = raw.flatMap((c): ClipData[] => {
    const clip = (c ?? {}) as Record<string, unknown>;
    const output = clip.outputAsset as Record<string, unknown> | undefined;
    const thumb = clip.thumbnailAsset as Record<string, unknown> | undefined;
    if (typeof output?.url !== "string") return [];
    return [
      {
        title: typeof clip.title === "string" ? clip.title : null,
        url: output.url,
        thumbnailUrl: typeof thumb?.url === "string" ? thumb.url : null,
        duration: typeof clip.duration === "number" ? clip.duration : null,
      },
    ];
  });

  return { status, clips };
}

function extractGenerationIds(payload: unknown): string[] {
  const root = (payload ?? {}) as Record<string, unknown>;
  const out: string[] = [];

  const gens = root.generations;
  if (Array.isArray(gens)) {
    for (const g of gens) {
      const id = (g as Record<string, unknown> | null)?.id;
      if (typeof id === "string") out.push(id);
    }
  }

  // Watermark removal returns the processed video ids as `videoIds`.
  if (Array.isArray(root.videoIds)) {
    for (const id of root.videoIds) {
      if (typeof id === "string") out.push(id);
    }
  }

  if (out.length === 0) {
    const generation = root.generation as Record<string, unknown> | undefined;
    // Upscalers return `job`, the voice changer returns `conversion`.
    const job = root.job as Record<string, unknown> | undefined;
    const conversion = root.conversion as Record<string, unknown> | undefined;
    const data = root.data as Record<string, unknown> | undefined;
    const candidate =
      generation?.id ??
      job?.id ??
      conversion?.id ??
      data?.id ??
      root.id ??
      root.generationId;
    if (typeof candidate === "string") out.push(candidate);
  }

  return out;
}

/**
 * Result of a create tool with a preview: the note plus the raw payload for
 * the model, and the preview contract for the widget. `aspectRatio` sizes the
 * batch tiles (e.g. 16:9 thumbnails).
 */
function previewResult(
  payload: unknown,
  tool: GenerationKind,
  mcpTool: string,
  opts: { aspectRatio?: string } = {},
) {
  const generation = GENERATIONS[tool];
  return structuredResult(
    payload,
    {
      ...asObject(payload),
      ...(opts.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
      generationIds: extractGenerationIds(payload),
      tool,
      kind: generation.kind,
      mcpTool,
      status: "queued",
    },
    { prefix: `${previewNote(generation.wait)} ` },
  );
}

const workflowGuide = `# Unsora API workflows (polling only — no webhooks)

## Supported social platforms
Posts can target any connected account on: YouTube, TikTok, Instagram,
Facebook, LinkedIn, Pinterest, Threads and Bluesky. Connect accounts in the
Unsora app; get_accounts returns them with a "provider" field.
- YouTube: video only; title via title / accountOverrides.
- Pinterest: 1 image, 2–5 images or a video; no text-only pins.
- Instagram and TikTok: no text-only posts.

## Composing posts in app-capable hosts
compose_post opens an editable composer (accounts, caption, media, per-platform
options, schedule) that creates the post itself. Prefill what the user gave,
then let them finish there — don't also call create_post. Outside such hosts,
use create_post directly.

## Uploading media
upload_file imports a public URL (or small base64 payload) into the user's
library and returns a hosted url — use it when the user supplies their own
media for posts, reference images, or clipping. Available to every
authenticated user.

## Typical: generate image → schedule social post
1. get_accounts — pick account ids
2. get_credits / get_subscription — verify plan + balance
3. create_image — get generation.id
4. wait_for_image — poll until outputUrl ready
5. create_post — slideshow or video with optional scheduled_at

## Video (Kling / Veo / Sora / Wan / Seedance / Gemini Omni Flash)
create_video → wait_for_video → create_post
Unless stated otherwise, the video resolution in models will be 720p by
default. And also the audio parameter will always be on by default.

## Thumbnails & influencers (image jobs, may return multiple ids)
create_thumbnail / create_influencer → wait_for_image (per id)

## Music (Mureka AI — song or BGM)
create_music (lyrics + style prompt) → wait_for_music. Renders a live audio
player in app-capable hosts; only poll with wait_for_music in hosts without it.

## Voiceover (script → speech, ElevenLabs Eleven v3)
list_voiceover_voices → create_voiceover (text + voice_id) → wait_for_voiceover.
list_voiceover_voices renders an interactive voice picker UI in app-capable
hosts — never re-list the voices as a table/list in text there; let the user
pick from the picker. Only share preview clip URLs in hosts without the UI.
Renders a live audio player in app-capable hosts; only poll with
wait_for_voiceover in hosts without it.

## Cloned voices & voice changer
create_voice_clone (name + a clean 1–2 min speech sample) → returns a clone
id. list_voices shows every usable voice: MiniMax presets, Eleven v3 voices,
and the user's clones. A clone id works as voice_id in create_voiceover and
create_avatar_video. change_voice re-voices existing speech (audio or video)
into a cloned voice → wait_for_voiceover.

## Upscaling
upscale_image (2k / 4k / 8k) → wait_for_image.
upscale_video (standard / ultra-1080p / ultra-4k) → wait_for_video.

## Subtitle & watermark removal
remove_watermark (direct video file URL) → wait_for_video. Strips burned-in
subtitles, captions, watermarks and logos.

## Motion control & talking avatars (video jobs)
create_motion_control (motion reference video + character image) →
wait_for_video. The character performs the reference video's movement.
create_avatar_video (portrait + transcript or audio) → wait_for_video.
Pick the transcript voice with list_voices.

## Movie materials (AI film pre-production, image jobs)
create_movie_material — character face / full-body / turnaround sheet,
location, first frame, style collage, 2x4 or 1x4 storyboard → wait_for_image.

## Clipping (long video → many short clips)
create_clipping (public videoUrl). In hosts that render the live preview
panel (e.g. Claude.ai), STOP after creating — the preview polls progress and
shows the clips itself; do not call wait_for_clipping or
clipping_status. Only poll with wait_for_clipping in hosts
without the preview, or when the user explicitly asks for the output URLs.

## Posts need paid plan (isActive on subscription).

## Posting now vs scheduling
create_post without scheduled_at saves a DRAFT (scheduled_at must be at
least 2 minutes ahead). To post right away pass publishNow: true, or call
publish_post with an existing draft/scheduled post id.

## Analytics
get_post_analytics — views, likes, comments and shares of published posts
over 7–90 days. Pass refresh: true to pull fresh numbers from the platforms.

## Library
list_generations (by type) browses past results — images, videos, music,
voiceovers, clips, upscales, avatars and more. delete_generation removes one
permanently; confirm with the user first.

## Instagram media requirements (Instagram rejects bad ratios at publish)
- Feed images / slideshow (carousel) images: aspect ratio 4:5 … 1.91:1.
  Safe sizes: 1080x1350 (4:5), 1080x1080 (1:1), 1080x566 (1.91:1).
  9:16 images are REJECTED for Instagram feed/carousel.
- Reels (video): 9:16 recommended, 1080x1920.
- TikTok slideshows/videos: 9:16 is ideal.
- Posting the same slideshow to Instagram AND TikTok? Generate 4:5 images
  (both accept them) or create separate posts per platform.

## Failed posts
If a post is FAILED or PARTIALLY_PUBLISHED (one platform succeeded, another
failed), call retry_post with the post id — it re-attempts only the failed
accounts and never double-posts. Do NOT create a duplicate post to retry.
`;

function unsoraFor(
  resolveUnsora: UnsoraAuthResolver,
  authInfo?: AuthInfo,
): UnsoraApi {
  return resolveUnsora(authInfo);
}

export function registerTools(server: McpServer, resolveUnsora: UnsoraAuthResolver) {
  server.resource("unsora-workflows", "unsora://workflows", async () => ({
    contents: [
      {
        uri: "unsora://workflows",
        mimeType: "text/markdown",
        text: workflowGuide,
      },
    ],
  }));

  // Media previews: one widget (image / video / audio) and its app-only
  // status tool per kind — see the preview contract at the top of this file.
  for (const kind of PREVIEW_KINDS) {
    const preview = PREVIEWS[kind];

    registerAppResource(
      server,
      preview.name,
      preview.uri,
      { description: `Live preview for ${kind} generation jobs` },
      async () => ({
        contents: [
          {
            uri: preview.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: await widgetHtml(kind),
            _meta: { ui: resourceUiMeta() },
          },
        ],
      }),
    );

    registerAppTool(
      server,
      preview.statusTool,
      {
        title: `${kind[0].toUpperCase()}${kind.slice(1)} Status`,
        description:
          "Single-shot generation status check (used by the preview UI).",
        inputSchema: { tool: z.enum(GENERATION_KINDS), id: z.string() },
        annotations: { ...READ_ONLY, idempotentHint: true },
        _meta: { ui: { resourceUri: preview.uri, visibility: ["app"] } },
      },
      async (args, extra) =>
        checkGenerationStatus(
          unsoraFor(resolveUnsora, extra.authInfo),
          kind,
          args.tool,
          args.id,
        ),
    );
  }

  for (const widget of KIT_WIDGETS) {
    registerAppResource(
      server,
      widget.name,
      widget.uri,
      { description: widget.description },
      async () => ({
        contents: [
          {
            uri: widget.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: await loadWidget(widget.file),
            _meta: { ui: resourceUiMeta(AVATAR_DOMAINS) },
          },
        ],
      }),
    );
  }

  registerAppResource(
    server,
    "Unsora Clipping Preview",
    CLIPPING_UI_URI,
    { description: "Live preview for AI clipping jobs (multiple clips)" },
    async () => ({
      contents: [
        {
          uri: CLIPPING_UI_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadWidget("clipping-view.html"),
          _meta: { ui: resourceUiMeta() },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "clipping_status",
    {
      title: "Clip Status",
      description:
        "Single-shot AI clipping job status + clips (used by the preview UI).",
      inputSchema: { tool: z.enum(["clipping"]), id: z.string() },
      annotations: { ...READ_ONLY, idempotentHint: true },
      _meta: { ui: { resourceUri: CLIPPING_UI_URI, visibility: ["app"] } },
    },
    async (args, extra) =>
      checkClippingStatus(unsoraFor(resolveUnsora, extra.authInfo), args.id),
  );

  registerAppTool(
    server,
    "create_clipping",
    {
      title: "Create Clips",
      description:
        "Turn a long video into short clips (AI clipping). Use this for any request to clip, cut, " +
        "chop, trim or repurpose a long video, podcast, stream, webinar or interview into shorts, " +
        "Reels, TikToks or YouTube Shorts, or to find and extract specific moments or highlights " +
        "(set query to describe the moments in natural language). Provide a public videoUrl. " +
        "DO NOT call this tool until the user has explicitly chosen: aspect ratio, captions on/off " +
        "(and style if on), number of clips, and clip length (not needed when query is set). " +
        "This tool spends the user's credits — if any of these choices is missing from the " +
        "conversation, you MUST stop and ask the user for all missing ones first. " +
        "Never assume defaults, never infer unstated preferences. " +
        "In app-capable hosts this renders a live preview that polls progress and displays the " +
        "clips by itself — when the preview is rendered, do NOT call wait_for_clipping or " +
        "clipping_status afterwards; summarize the job settings and end your turn. " +
        "Only poll with wait_for_clipping in hosts without the preview.",
      inputSchema: {
        videoUrl: z
          .string()
          .url()
          .describe(
            "YouTube link or direct video file URL (e.g. .mp4). " +
              "Page links from other platforms (TikTok, Instagram, Vimeo) are not supported.",
          ),
        sourceLang: z.string().optional(),
        targetLang: z.string().optional(),
        targetDuration: z
          .enum(["auto", "lt30", "30-60", "60-90", "90-3min", "gt3min"])
          .optional(),
        query: z
          .string()
          .max(500)
          .optional()
          .describe(
            "Find Moments mode: natural-language description of the moments to extract " +
              "(e.g. 'funny reactions', 'product demos', 'goal moments and key plays'). " +
              "When set, targetDuration is ignored. Omit to auto-detect the most viral clips.",
          ),
        limit: z.number().int().min(1).max(20).optional(),
        ratio: z
          .enum(CLIP_RATIOS)
          .optional()
          .describe(
            "Output aspect ratio. AI reframe keeps the main subject centered. " +
              "9:16 for TikTok/Reels/Shorts, 1:1 or 4:5 for feed posts, 16:9 for YouTube. " +
              "Omit or use 'original' to keep the source ratio.",
          ),
        enableCaption: z
          .boolean()
          .optional()
          .describe(
            "Burn animated captions into the clips. Auto-enabled when captionStyle is set.",
          ),
        captionStyle: z
          .enum(CAPTION_STYLE_PRESETS)
          .optional()
          .describe(
            "Caption look, named by appearance: colors are the accent on the spoken word " +
              "(e.g. classic-yellow = white text, yellow active word). " +
              "glow-* add a soft glow, static-* don't animate, gaming-* are bold streamer styles, " +
              "white-card/black-box put text on a card. Default: classic-yellow.",
          ),
      },
      _meta: { ui: { resourceUri: CLIPPING_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const body: Record<string, unknown> = { videoUrl: args.videoUrl };
      if (args.sourceLang) body.sourceLang = args.sourceLang;
      if (args.targetLang) body.targetLang = args.targetLang;
      if (args.targetDuration) body.targetDuration = args.targetDuration;
      if (args.query) body.query = args.query;
      if (args.limit) body.limit = args.limit;
      if (args.ratio && args.ratio !== "original") body.ratio = args.ratio;
      const enableCaption =
        args.enableCaption ?? (args.captionStyle ? true : undefined);
      if (enableCaption !== undefined) {
        body.enableCaption = enableCaption;
      }
      if (args.captionStyle) body.captionStyle = args.captionStyle;

      const payload = await unsora.request("POST", "/clippings/create", {
        body,
      });

      return structuredResult(
        payload,
        {
          ...asObject(payload),
          ...(args.ratio && args.ratio !== "original"
            ? { aspectRatio: args.ratio }
            : {}),
          generationIds: extractGenerationIds(payload).slice(0, 1),
          tool: "clipping",
          kind: "clipping",
          mcpTool: "create_clipping",
          status: "queued",
        },
        { prefix: `${previewNote("wait_for_clipping")} ` },
      );
    },
  );

  server.registerTool(
    "wait_for_clipping",
    {
      annotations: READ_ONLY,
      title: "Wait for Clips",
      description:
        "Poll an AI clipping job until COMPLETED or FAILED. Returns clips with output URLs. " +
        "Do NOT use this when the live preview panel is rendered (it polls by itself) — " +
        "only in hosts without the preview, or when the user explicitly asks for output URLs.",
      inputSchema: {
        clippingId: z.string(),
        maxAttempts: z.number().int().min(1).max(240).optional(),
        intervalSeconds: z.number().min(2).max(60).optional(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).pollClippingStatus(
          args.clippingId,
          {
            maxAttempts: args.maxAttempts,
            intervalMs: (args.intervalSeconds ?? 5) * 1000,
          },
        ),
      ),
  );

  registerAppTool(
    server,
    "get_credits",
    {
      title: "Check Credits",
      description: "Get current credit balance." + SHOWN_IN_UI,
      inputSchema: {},
      annotations: READ_ONLY,
      _meta: { ui: { resourceUri: ACCOUNT_UI_URI } },
    },
    async (_args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          "/user/credits",
        ),
      ),
  );

  registerAppTool(
    server,
    "get_subscription",
    {
      annotations: READ_ONLY,
      title: "Check Subscription",
      description:
        "Get plan and Stripe subscription state (check isActive before scheduling posts)." +
        SHOWN_IN_UI,
      inputSchema: {},
      _meta: { ui: { resourceUri: ACCOUNT_UI_URI } },
    },
    async (_args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          "/user/subscription",
        ),
      ),
  );

  registerAppTool(
    server,
    "get_accounts",
    {
      annotations: READ_ONLY,
      title: "Connected Accounts",
      description:
        "List connected social accounts for scheduling. Supported platforms: " +
        "YouTube, TikTok, Instagram, Facebook, LinkedIn, Pinterest, Threads and Bluesky. " +
        "Each account has a provider field identifying its platform " +
        "(YouTube accounts have provider \"google\")." +
        SHOWN_IN_UI,
      inputSchema: {},
      _meta: { ui: { resourceUri: ACCOUNTS_UI_URI } },
    },
    async (_args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          "/accounts",
        ),
      ),
  );

  registerAppTool(
    server,
    "pinterest_boards",
    {
      title: "Pinterest Boards",
      description: "Boards a connected Pinterest account can pin to (used by the composer UI).",
      inputSchema: { accountId: z.string() },
      annotations: { ...READ_ONLY, idempotentHint: true },
      _meta: { ui: { resourceUri: COMPOSER_UI_URI, visibility: ["app"] } },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `/accounts/${encodeURIComponent(args.accountId)}/pinterest/boards`,
        ),
      ),
  );

  registerAppTool(
    server,
    "tiktok_creator_info",
    {
      title: "TikTok Posting Options",
      description:
        "TikTok creator info for a connected account: allowed privacy levels, whether " +
        "comments/duets/stitches are disabled, max video length (used by the composer UI).",
      inputSchema: { accountId: z.string() },
      annotations: { ...READ_ONLY, idempotentHint: true },
      _meta: { ui: { resourceUri: COMPOSER_UI_URI, visibility: ["app"] } },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `/accounts/${encodeURIComponent(args.accountId)}/tiktok/creator-info`,
        ),
      ),
  );

  registerAppTool(
    server,
    "create_image",
    {
      title: "Create Image",
      description:
        "Generate an image for a social post, thumbnail or ad creative (nano-banana-2 default). Returns generation.id — poll with wait_for_image. Renders a live preview in app-capable hosts.",
      inputSchema: {
        prompt: z.string().describe("Image prompt"),
        model: z
          .enum([
            "nano-banana-2",
            "nano-banana-pro",
            "seedream-v5-lite",
            "gpt-image-1.5",
            "gpt-image-2",
          ])
          .optional(),
        aspectRatio: z.string().optional().describe("Aspect ratio, e.g. 1:1"),
        resolution: z.string().optional(),
        referenceImages: z.array(z.string().url()).optional(),
        nsfwChecker: z.boolean().optional(),
        idempotencyKey: z.string().max(128).optional(),
      },
      _meta: { ui: { resourceUri: IMAGE_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const body: Record<string, unknown> = { prompt: args.prompt };
      if (args.model) body.model = args.model;
      if (args.aspectRatio) body.aspectRatio = args.aspectRatio;
      if (args.resolution) body.resolution = args.resolution;
      if (args.referenceImages?.length) {
        body.referenceImages = args.referenceImages;
      }
      if (args.nsfwChecker !== undefined) body.nsfwChecker = args.nsfwChecker;

      const payload = await unsora.request(
        "POST",
        "/image-generations/create",
        { body, idempotencyKey: args.idempotencyKey },
      );

      return previewResult(payload, "image", "create_image", { aspectRatio: args.aspectRatio });
    },
  );

  server.registerTool(
    "wait_for_image",
    {
      annotations: READ_ONLY,
      title: "Wait for Image",
      description:
        "Poll an image job until COMPLETED or FAILED: create_image, create_influencer, " +
        "create_thumbnail, upscale_image and create_movie_material.",
      inputSchema: {
        generationId: z.string(),
        maxAttempts: z.number().int().min(1).max(120).optional(),
        intervalSeconds: z.number().min(2).max(60).optional(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).pollImageStatus(
          args.generationId,
          {
            maxAttempts: args.maxAttempts,
            intervalMs: (args.intervalSeconds ?? 5) * 1000,
          },
        ),
      ),
  );

  registerAppTool(
    server,
    "create_influencer",
    {
      title: "Create AI Influencer",
      description:
        "Generate an AI influencer portrait for a social account or UGC-style post. Renders a live preview grid in app-capable hosts; poll each id with wait_for_image otherwise.",
      inputSchema: {
        prompt: z.string(),
        aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
        count: z.number().int().min(1).max(10).optional(),
        cameraAngle: z
          .enum(["pov", "portrait", "full-body", "close-up", "side-profile"])
          .optional(),
        styleMode: z
          .enum(INFLUENCER_STYLE_MODES)
          .optional()
          .describe("Look / lighting preset."),
        age: z
          .number()
          .int()
          .min(18)
          .max(70)
          .optional()
          .describe("Subject age in years (18–70)."),
      },
      _meta: { ui: { resourceUri: IMAGE_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const body: Record<string, unknown> = { prompt: args.prompt };
      if (args.aspectRatio) body.aspectRatio = args.aspectRatio;
      if (args.count) body.count = args.count;
      if (args.cameraAngle) body.cameraAngle = args.cameraAngle;
      if (args.styleMode) body.styleMode = args.styleMode;
      if (args.age) body.age = args.age;

      const payload = await unsora.request(
        "POST",
        "/influencer-studio/create",
        { body },
      );

      return previewResult(payload, "influencer", "create_influencer", { aspectRatio: args.aspectRatio });
    },
  );

  registerAppTool(
    server,
    "create_thumbnail",
    {
      title: "Create Thumbnail",
      description:
        "Generate a YouTube thumbnail (16:9) for a video you are publishing. Returns one job per variation. Renders a live preview grid in app-capable hosts; poll each id with wait_for_image otherwise.",
      inputSchema: {
        prompt: z.string().optional(),
        referenceImageUrls: z.array(z.string().url()).optional(),
        templateImageUrls: z.array(z.string().url()).max(1).optional(),
        context: z.array(z.string()).optional(),
        expression: z.string().optional(),
        variations: z.number().int().min(1).max(10).optional(),
      },
      _meta: { ui: { resourceUri: IMAGE_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const body: Record<string, unknown> = {};
      if (args.prompt) body.prompt = args.prompt;
      if (args.referenceImageUrls?.length) {
        body.referenceImageUrls = args.referenceImageUrls;
      }
      if (args.templateImageUrls?.length) {
        body.templateImageUrls = args.templateImageUrls;
      }
      if (args.context?.length) body.context = args.context;
      if (args.expression) body.expression = args.expression;
      if (args.variations) body.variations = args.variations;

      const payload = await unsora.request("POST", "/thumbnails/create", {
        body,
      });

      return previewResult(payload, "thumbnail", "create_thumbnail", { aspectRatio: "16:9" });
    },
  );

  registerAppTool(
    server,
    "create_music",
    {
      title: "Create Music",
      description:
        "Generate a music bed or song for a social video, Reel or ad (Mureka AI, song or instrumental BGM). " +
        "Song models (auto, mureka-9, mureka-8, mureka-o2, mureka-7.6) require lyrics; " +
        "mureka-7.5 generates instrumental BGM and treats lyrics as optional. " +
        "The prompt sets genre, mood, tempo, and vocal style (e.g. 'r&b, slow, passionate, male vocal'). " +
        "Returns generation.id — poll with wait_for_music. Renders a live audio player in app-capable hosts.",
      inputSchema: {
        prompt: z
          .string()
          .max(1024)
          .describe("Style prompt — genre, mood, tempo, vocal style."),
        lyrics: z
          .string()
          .max(3000)
          .optional()
          .describe(
            "Song lyrics (max 3000 chars). Required for song models; optional for mureka-7.5 BGM. " +
              "Section labels like [Verse] and [Chorus] are supported.",
          ),
        model: z.enum(MUSIC_MODELS).optional(),
        output_format: z.enum(["mp3", "wav", "flac"]).optional(),
        idempotencyKey: z.string().max(128).optional(),
      },
      _meta: { ui: { resourceUri: AUDIO_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const body: Record<string, unknown> = { prompt: args.prompt };
      if (args.lyrics) body.lyrics = args.lyrics;
      if (args.model) body.model = args.model;
      if (args.output_format) body.output_format = args.output_format;

      const payload = await unsora.request(
        "POST",
        "/music-generations/create",
        { body, idempotencyKey: args.idempotencyKey },
      );

      return previewResult(payload, "music", "create_music");
    },
  );

  server.registerTool(
    "wait_for_music",
    {
      annotations: READ_ONLY,
      title: "Wait for Music",
      description: "Poll music status until COMPLETED or FAILED",
      inputSchema: {
        generationId: z.string(),
        maxAttempts: z.number().int().min(1).max(180).optional(),
        intervalSeconds: z.number().min(2).max(60).optional(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).pollMusicStatus(
          args.generationId,
          {
            maxAttempts: args.maxAttempts,
            intervalMs: (args.intervalSeconds ?? 5) * 1000,
          },
        ),
      ),
  );

  registerAppResource(
    server,
    "Unsora Voice Picker",
    VOICES_UI_URI,
    { description: "Voice catalog with tap-to-play previews" },
    async () => ({
      contents: [
        {
          uri: VOICES_UI_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadWidget("voices-view.html"),
          _meta: { ui: resourceUiMeta() },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "list_voiceover_voices",
    {
      annotations: READ_ONLY,
      title: "List Voiceover Voices",
      description:
        "List the 20 ElevenLabs Eleven v3 voices available for create_voiceover, " +
        "each with a description, gender, accent, and a short preview clip URL. " +
        "In app-capable hosts (e.g. Claude.ai) this tool renders an interactive " +
        "voice picker with tap-to-play previews — the user already sees every " +
        "voice, so do NOT repeat the voices as a table, list, or summary in your " +
        "reply; just tell the user to pick from the picker above. Only in hosts " +
        "without the UI, share the preview URLs so the user can hear a voice " +
        "before choosing it.",
      inputSchema: {},
      _meta: { ui: { resourceUri: VOICES_UI_URI } },
    },
    async (_args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          "/voiceovers/voices",
        ),
      ),
  );

  registerAppTool(
    server,
    "create_voiceover",
    {
      title: "Create Voiceover",
      description:
        "Generate a voiceover for a social video, Reel or ad from a script. " +
        "Use list_voiceover_voices first and let the user pick an ElevenLabs Eleven v3 voice " +
        "from the previews; the user's cloned voices and MiniMax presets (see list_voices) work too. " +
        "Costs: Eleven v3 6 credits per started 1,000 characters; cloned voices 3 credits per " +
        "started 500 characters; MiniMax presets 1 credit per started 1,000 characters. " +
        "Supports <#x#> tags between words to pause for x seconds (0.01–99.99). " +
        "Returns generation.id — poll with wait_for_voiceover. Renders a live audio player in app-capable hosts.",
      inputSchema: {
        text: z
          .string()
          .max(10000)
          .describe("Script to voice (max 10,000 characters)."),
        voice_id: z
          .string()
          .describe(
            `Eleven v3 voice (${VOICEOVER_VOICES.join(", ")}) — see list_voiceover_voices ` +
              "for previews — or a cloned voice id / MiniMax preset id from list_voices.",
          ),
        speed: z
          .number()
          .min(0.5)
          .max(2)
          .optional()
          .describe("Speaking speed 0.5–2, default 1."),
        emotion: z
          .enum(VOICE_EMOTIONS)
          .optional()
          .describe("Delivery emotion — MiniMax preset voices only. Default neutral."),
        stability: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "Eleven v3 only. 0–1, default 0.5. Higher = more consistent delivery, lower = more expressive.",
          ),
        similarity: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "Eleven v3 only. 0–1, default 1. How closely the output sticks to the base voice.",
          ),
        idempotencyKey: z.string().max(128).optional(),
      },
      _meta: { ui: { resourceUri: AUDIO_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const body: Record<string, unknown> = {
        text: args.text,
        voice_id: args.voice_id,
      };
      if (args.speed !== undefined) body.speed = args.speed;
      if (args.emotion) body.emotion = args.emotion;
      if (args.stability !== undefined) body.stability = args.stability;
      if (args.similarity !== undefined) body.similarity = args.similarity;

      const payload = await unsora.request("POST", "/voiceovers/create", {
        body,
        idempotencyKey: args.idempotencyKey,
      });

      return previewResult(payload, "voiceover", "create_voiceover");
    },
  );

  server.registerTool(
    "wait_for_voiceover",
    {
      annotations: READ_ONLY,
      title: "Wait for Voiceover",
      description:
        "Poll a voiceover or change_voice job until COMPLETED or FAILED.",
      inputSchema: {
        generationId: z.string(),
        maxAttempts: z.number().int().min(1).max(180).optional(),
        intervalSeconds: z.number().min(2).max(60).optional(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).pollVoiceoverStatus(
          args.generationId,
          {
            maxAttempts: args.maxAttempts,
            intervalMs: (args.intervalSeconds ?? 5) * 1000,
          },
        ),
      ),
  );

  registerAppTool(
    server,
    "list_voices",
    {
      _meta: { ui: { resourceUri: VOICES_UI_URI } },
      annotations: READ_ONLY,
      title: "List All Voices",
      description:
        "List every voice the user can use: MiniMax presets (presets), ElevenLabs Eleven v3 " +
        "voices with preview URLs (elevenV3Voices), and the user's own cloned voices (clones — " +
        "use the clone id). Voices work as voice_id in create_voiceover and create_avatar_video; " +
        "change_voice needs a cloned voice. Also returns the clone limit (maxClones) and " +
        "cloneCreditCost." + SHOWN_IN_UI,
      inputSchema: {},
    },
    async (_args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          "/voice-clones",
        ),
      ),
  );

  registerAppTool(
    server,
    "create_voice_clone",
    {
      _meta: { ui: { resourceUri: VOICES_UI_URI } },
      title: "Clone Voice",
      description:
        "Create an instant voice clone from a speech recording (ElevenLabs). Only clone the " +
        "user's own voice or a voice they have permission to use. Best results: 1–2 minutes of " +
        "clean speech with no music or background noise. Costs 15 credits; max 10 clones per " +
        "account. Returns clone.id — use it as voice_id in create_voiceover, " +
        "create_avatar_video and change_voice." + SHOWN_IN_UI,
      inputSchema: {
        name: z.string().min(1).max(80).describe("Name for the cloned voice."),
        sampleUrl: z
          .string()
          .url()
          .describe(
            "Public URL of the voice sample (mp3, wav, m4a, ogg, webm or mp4). " +
              "Use upload_file first for a file the user provides.",
          ),
        description: z.string().max(500).optional(),
      },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = {
        name: args.name,
        sample_url: args.sampleUrl,
      };
      if (args.description) body.description = args.description;
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "POST",
          "/voice-clones/create",
          { body },
        ),
      );
    },
  );

  registerAppTool(
    server,
    "delete_voice_clone",
    {
      _meta: { ui: { resourceUri: VOICES_UI_URI } },
      title: "Delete Voice Clone",
      description:
        "Permanently delete one of the user's cloned voices. Confirm with the user first." + SHOWN_IN_UI,
      inputSchema: {
        cloneId: z.string().describe("Clone id from list_voices."),
      },
      annotations: { destructiveHint: true },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "DELETE",
          `/voice-clones/${encodeURIComponent(args.cloneId)}`,
        ),
      ),
  );

  registerAppTool(
    server,
    "change_voice",
    {
      title: "Change Voice",
      description:
        "Re-voice existing speech into one of the user's cloned voices (Voice Changer, " +
        "speech-to-speech): keeps the timing and delivery of the source, swaps the voice. " +
        "The source can be audio or video, up to 5 minutes. Costs about 10 credits per minute. " +
        "voiceId must be a cloned voice id from list_voices (create one with create_voice_clone). " +
        "Poll with wait_for_voiceover. Renders a live audio player in app-capable hosts.",
      inputSchema: {
        voiceId: z.string().describe("Cloned voice id (list_voices → clones)."),
        sourceUrl: z
          .string()
          .url()
          .describe("Public URL of the speech audio or video to convert."),
        outputFormat: z.enum(["mp3", "wav"]).optional().describe("Default mp3."),
      },
      _meta: { ui: { resourceUri: AUDIO_UI_URI } },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = {
        voice_id: args.voiceId,
        source_url: args.sourceUrl,
      };
      if (args.outputFormat) body.output_format = args.outputFormat;

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/voice-conversions/create",
        { body },
      );
      return previewResult(payload, "voice_change", "change_voice");
    },
  );

  registerAppTool(
    server,
    "create_video",
    {
      title: "Create Video",
      description:
        "Generate a short video for a social post, Reel, TikTok or ad (Kling v3, Veo 3.1, Sora 2, Wan 2.6, Seedance 2.0, Gemini Omni Flash). Poll with wait_for_video. Renders a live preview in app-capable hosts.",
      inputSchema: {
        prompt: z.string(),
        model: z
          .enum([
            "kling-standard",
            "kling-pro",
            "veo",
            "veo-fast",
            "veo-lite",
            "sora-2",
            "sora-2-pro",
            "wan",
            "seedance-2.0",
            "seedance-2.0-fast",
            "seedance-2.0-mini",
            "gemini-omni-flash",
          ])
          .optional()
          .describe("Video model key. Default: seedance-2.0"),
        aspectRatio: z.string().optional().describe("Aspect ratio, e.g. 16:9"),
        duration: z.number().int().min(1).max(20).optional(),
        negativePrompt: z.string().optional(),
        resolution: z
          .string()
          .optional()
          .describe("720p or 1080p (Wan 2.6 only)"),
        sound: z
          .boolean()
          .optional()
          .describe("Generate audio (Kling / Veo models)"),
        image: z
          .string()
          .url()
          .optional()
          .describe("Start image for image-to-video / first frame"),
        lastImage: z.string().url().optional().describe("End/last frame image"),
        referenceImages: z
          .array(z.string().url())
          .max(9)
          .optional()
          .describe(
            "Reference images (Veo / Seedance up to 9; Gemini Omni Flash up to 4 — multiple images switch it to reference-to-video; for a single start image use `image` instead)",
          ),
        referenceVideos: z
          .array(z.string().url())
          .max(3)
          .optional()
          .describe("Seedance only"),
        referenceAudios: z
          .array(z.string().url())
          .max(3)
          .optional()
          .describe("Seedance only"),
        generateAudio: z
          .boolean()
          .optional()
          .describe("Seedance only — generate a soundtrack"),
        idempotencyKey: z.string().max(128).optional(),
      },
      _meta: { ui: { resourceUri: VIDEO_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const { idempotencyKey, ...body } = args;
      const payload = await unsora.request("POST", "/videos/create", {
        body,
        idempotencyKey,
      });

      return previewResult(payload, "video", "create_video", { aspectRatio: args.aspectRatio });
    },
  );

  server.registerTool(
    "wait_for_video",
    {
      annotations: READ_ONLY,
      title: "Wait for Video",
      description:
        "Poll a video job until COMPLETED or FAILED: create_video, create_motion_control, " +
        "create_avatar_video, upscale_video and remove_watermark.",
      inputSchema: {
        generationId: z.string(),
        maxAttempts: z.number().int().min(1).max(180).optional(),
        intervalSeconds: z.number().min(2).max(60).optional(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).pollVideoStatus(
          args.generationId,
          {
            maxAttempts: args.maxAttempts,
            intervalMs: (args.intervalSeconds ?? 5) * 1000,
          },
        ),
      ),
  );

  registerAppTool(
    server,
    "upscale_image",
    {
      title: "Upscale Image",
      description:
        "Upscale an image to 2K, 4K or 8K (Image Upscaler). Costs 2 / 3 / 5 credits. " +
        "Pass a public imageUrl — a generation outputUrl or an upload_file url. " +
        "Poll with wait_for_image. Renders a live preview in app-capable hosts.",
      inputSchema: {
        imageUrl: z.string().url().describe("Public URL of the image to upscale."),
        resolution: z
          .enum(["2k", "4k", "8k"])
          .optional()
          .describe("Target resolution. Default 2k."),
      },
      _meta: { ui: { resourceUri: IMAGE_UI_URI } },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = { imageUrl: args.imageUrl };
      if (args.resolution) body.resolution = args.resolution;

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/image-upscaler/create",
        { body },
      );
      return previewResult(payload, "image_upscale", "upscale_image");
    },
  );

  registerAppTool(
    server,
    "upscale_video",
    {
      title: "Upscale Video",
      description:
        "Upscale a video's resolution and sharpness (Video Upscaler). Models: standard " +
        "(10 credits), ultra-1080p (6 / 11 / 16 credits for up to 5s / 10s / longer), " +
        "ultra-4k (22 / 43 / 64 credits). Pass a direct video file URL (e.g. .mp4 — a " +
        "generation outputUrl or an upload_file url). Poll with wait_for_video. Renders a " +
        "live preview in app-capable hosts.",
      inputSchema: {
        videoUrl: z
          .string()
          .url()
          .describe("Direct URL of the video file to upscale."),
        model: z
          .enum(VIDEO_UPSCALE_MODELS)
          .optional()
          .describe("Default standard."),
      },
      _meta: { ui: { resourceUri: VIDEO_UI_URI } },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = { videoUrl: args.videoUrl };
      if (args.model) body.model = args.model;

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/video-upscaler/create",
        { body },
      );
      return previewResult(payload, "video_upscale", "upscale_video");
    },
  );

  registerAppTool(
    server,
    "remove_watermark",
    {
      title: "Remove Subtitles & Watermarks",
      description:
        "Remove burned-in subtitles, captions, watermarks, logos or on-screen text from a video " +
        "(Subtitle Remover). Costs 10 credits per started 10 seconds of video. Pass a direct " +
        "video file URL (e.g. .mp4) — page links (YouTube, TikTok) don't work; use upload_file " +
        "first for a file the user provides. Poll with wait_for_video. Renders a live preview " +
        "in app-capable hosts.",
      inputSchema: {
        videoUrl: z.string().url().describe("Direct URL of the video file."),
        name: z
          .string()
          .max(200)
          .optional()
          .describe("Label in the user's library. Defaults to the file name."),
      },
      _meta: { ui: { resourceUri: VIDEO_UI_URI } },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = { videoUrl: args.videoUrl };
      if (args.name) body.name = args.name;

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/watermark-removal/create",
        { body },
      );
      return previewResult(payload, "watermark_removal", "remove_watermark");
    },
  );

  registerAppTool(
    server,
    "create_motion_control",
    {
      title: "Motion Control",
      description:
        "Make a character copy the motion of a reference video (Kling Motion Control): the " +
        "character in characterImageUrl performs the movement, dance or acting from " +
        "motionVideoUrl. Costs 148 credits. Motion video should be 5–30 seconds. " +
        "Poll with wait_for_video. Renders a live preview in app-capable hosts.",
      inputSchema: {
        motionVideoUrl: z
          .string()
          .url()
          .describe("Reference video whose motion is copied (5–30 seconds)."),
        characterImageUrl: z
          .string()
          .url()
          .describe("Image of the character who performs the motion."),
        prompt: z
          .string()
          .optional()
          .describe("Optional guidance for the scene, style or details."),
        model: z
          .enum(MOTION_CONTROL_MODEL_KEYS)
          .optional()
          .describe(
            "Default kling-3.0-pro (1080p). kling-3.0-std renders 720p; kling-2.6-pro 1080p.",
          ),
        keepSound: z
          .boolean()
          .optional()
          .describe("Keep the motion video's audio. Default true."),
        characterOrientation: z
          .enum(["video", "image"])
          .optional()
          .describe(
            "Whether the character's facing follows the motion video (default) or the character image.",
          ),
      },
      _meta: { ui: { resourceUri: VIDEO_UI_URI } },
    },
    async (args, extra) => {
      const model = MOTION_CONTROL_MODELS[args.model ?? "kling-3.0-pro"];
      const body: Record<string, unknown> = {
        model: model.id,
        resolution: model.resolution,
        motion_video_url: args.motionVideoUrl,
        character_image_url: args.characterImageUrl,
      };
      if (args.prompt) body.prompt = args.prompt;
      if (args.keepSound !== undefined) body.keep_sound = args.keepSound;
      if (args.characterOrientation) {
        body.character_orientation = args.characterOrientation;
      }

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/motion-control/create",
        { body },
      );
      return previewResult(payload, "motion_control", "create_motion_control");
    },
  );

  registerAppTool(
    server,
    "create_avatar_video",
    {
      title: "Create Talking Avatar",
      description:
        "Turn a portrait into a talking-head video (AI Avatar Maker, SkyReels V3): the person " +
        "in imageUrl speaks a transcript (voiced with voiceId) or lip-syncs a supplied audioUrl. " +
        "Costs 10 credits. Use list_voices to pick a voice — MiniMax presets, Eleven v3 voices, " +
        "or the user's cloned voices. Poll with wait_for_video. Renders a live preview in " +
        "app-capable hosts.",
      inputSchema: {
        imageUrl: z
          .string()
          .url()
          .describe("Portrait of the person or character, face clearly visible."),
        transcript: z
          .string()
          .max(2000)
          .optional()
          .describe(
            "What the avatar says (max 2,000 characters). Required unless audioUrl is set.",
          ),
        audioUrl: z
          .string()
          .url()
          .optional()
          .describe("Speech audio to lip-sync instead of a transcript."),
        voiceId: z
          .string()
          .optional()
          .describe("Voice for the transcript — an id from list_voices. Default Friendly_Person."),
        emotion: z
          .enum(VOICE_EMOTIONS)
          .optional()
          .describe("Delivery emotion. Default neutral."),
        prompt: z
          .string()
          .optional()
          .describe("Optional guidance for expression, gestures or setting."),
        resolution: z.enum(["480p", "720p"]).optional().describe("Default 720p."),
      },
      _meta: { ui: { resourceUri: VIDEO_UI_URI } },
    },
    async (args, extra) => {
      if (!args.transcript?.trim() && !args.audioUrl) {
        throw new Error("Provide either transcript or audioUrl");
      }
      const body: Record<string, unknown> = { image_url: args.imageUrl };
      if (args.transcript) body.transcript = args.transcript;
      if (args.audioUrl) body.audio_url = args.audioUrl;
      if (args.voiceId) body.voice_id = args.voiceId;
      if (args.emotion) body.emotion = args.emotion;
      if (args.prompt) body.prompt = args.prompt;
      if (args.resolution) body.resolution = args.resolution;

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/avatar-generations/create",
        { body },
      );
      return previewResult(payload, "avatar", "create_avatar_video");
    },
  );

  registerAppTool(
    server,
    "create_movie_material",
    {
      title: "Create Movie Material",
      description:
        "Generate pre-production reference images for AI films and ads (Movie Materials " +
        "Generator, GPT Image 2): character face references, full-body references, turnaround " +
        "sheets, location references, video first frames, style mood boards, and 2x4 / 1x4 " +
        "storyboards. Feed the results to create_video as reference images for consistent " +
        "characters and locations. Costs 3 / 4 / 6 credits at 1k / 2k / 4k. Poll with " +
        "wait_for_image. Renders a live preview in app-capable hosts.",
      inputSchema: {
        prompt: z
          .string()
          .describe("Describe the character, location, frame or shot sequence."),
        mode: z
          .enum(MOVIE_MATERIAL_MODES)
          .describe(
            "face = character face reference; wide-body = full body with outfit and pose; " +
              "sheet = multi-angle turnaround; location = scene/environment; " +
              "first-frame = opening frame of a shot; style-collage = mood board; " +
              "multishot-2x4 = 8-panel storyboard; multishot-1x4 = 4-panel strip.",
          ),
        params: z
          .record(z.string())
          .optional()
          .describe(
            "Style controls, each 'auto' by default. All modes: cinematography (auto, cinematic, " +
              "anime, realistic, cartoon, fantasy). face: age (auto, child, teen, adult, elderly), " +
              "gender (auto, male, female, neutral). first-frame: camera-angle (auto, eye-level, " +
              "low-angle, high-angle, dutch-angle, birds-eye, worms-eye, over-shoulder). " +
              "style-collage: color-palette (auto, warm, cool, muted, vibrant, monochrome, pastel, " +
              "neon), lighting-mood (auto, natural, golden-hour, blue-hour, neon-lit, studio, " +
              "dramatic, low-key, high-key), era-vibe (auto, modern, retro-70s, 80s-synth, " +
              "90s-grunge, noir, victorian, futuristic, analog-film).",
          ),
        ratio: z
          .enum(["auto", "1:1", "9:16", "16:9", "4:3", "3:4"])
          .optional()
          .describe("Default 3:4 for face and wide-body, 16:9 otherwise."),
        resolution: z.enum(["1k", "2k", "4k"]).optional().describe("Default 2k."),
        referenceImageUrls: z
          .array(z.string().url())
          .max(14)
          .optional()
          .describe(
            "Reference images — face, outfit, location or style inspiration, or earlier " +
              "character/location materials.",
          ),
      },
      _meta: { ui: { resourceUri: IMAGE_UI_URI } },
    },
    async (args, extra) => {
      const params: Record<string, string> = Object.fromEntries(
        MOVIE_MATERIAL_PARAMS[args.mode].map((key) => [key, "auto"]),
      );
      Object.assign(params, args.params);

      const ratio =
        args.ratio ??
        (args.mode === "face" || args.mode === "wide-body" ? "3:4" : "16:9");
      const body: Record<string, unknown> = {
        prompt: args.prompt,
        mode: args.mode,
        params,
        ratio,
      };
      if (args.resolution) body.resolution = args.resolution;
      if (args.referenceImageUrls?.length) {
        body.referenceImageUrls = args.referenceImageUrls;
      }

      const payload = await unsoraFor(resolveUnsora, extra.authInfo).request(
        "POST",
        "/movie-materials/create",
        { body },
      );
      return previewResult(payload, "movie_material", "create_movie_material", {
        aspectRatio: ratio,
      });
    },
  );

  registerAppTool(
    server,
    "create_post",
    {
      title: "Schedule Post",
      description:
        "Create, schedule, queue, publish or cross-post content to connected social accounts. " +
        "Use this for any request to post now, schedule for later, publish to multiple " +
        "platforms at once, or add something to the posting queue. Supported platforms: " +
        "YouTube, TikTok, Instagram, Facebook, LinkedIn, Pinterest, Threads and Bluesky. " +
        "When the user wants to set the post up themselves or per-platform options are " +
        "still open (TikTok privacy, YouTube title, Pinterest board), prefer compose_post, " +
        "which opens an editable composer in app-capable hosts. " +
        "Without scheduled_at the post is saved as a DRAFT — set publishNow: true to post " +
        "immediately. " +
        "Requires paid plan. Instagram feed/slideshow images must have an aspect ratio " +
        "between 4:5 (e.g. 1080x1350) and 1.91:1 (e.g. 1080x566) — 9:16 images are rejected " +
        "for Instagram (use 9:16 only for TikTok slideshows and video reels). " +
        "YouTube only takes video and uses `title` (video title). Pinterest needs media " +
        "(1 image, 2–5 images or a video)." +
        SHOWN_IN_UI,
      inputSchema: {
        caption: z.string(),
        accountIds: z.array(z.string()).min(1).max(10),
        mediaType: z.enum(["video", "slideshow", "none"]).optional(),
        mediaUrl: z.string().url().optional(),
        mediaUrls: z.array(z.string().url()).optional(),
        coverUrl: z
          .string()
          .url()
          .optional()
          .describe(
            "Video cover image URL (Instagram Reel cover, YouTube thumbnail, Pinterest video cover).",
          ),
        scheduled_at: z
          .string()
          .optional()
          .describe("ISO datetime at least 2 minutes ahead. Omit for a draft or publishNow."),
        timezone: z
          .string()
          .optional()
          .describe("IANA timezone the user scheduled in, e.g. Europe/London (display only)."),
        publishNow: z
          .boolean()
          .optional()
          .describe(
            "Publish immediately after creating. Ignored when scheduled_at is set.",
          ),
        external_id: z.string().max(128).optional(),
        title: z
          .string()
          .optional()
          .describe(
            "Title applied to every account (YouTube video title). " +
              "Ignored by platforms without titles.",
          ),
        accountOverrides: z
          .array(
            z.object({
              id: z.string().describe("Account id from get_accounts"),
              title: z.string().optional(),
              customCaption: z
                .string()
                .optional()
                .describe("Overrides the main caption for this account only"),
            }),
          )
          .optional()
          .describe("Per-account title/caption overrides (id must also be in accountIds)."),
        instagram: z
          .object({
            cover_url: z.string().url().optional().describe("Reel cover image URL."),
          })
          .optional()
          .describe("Instagram settings (applies to instagram accounts)."),
        tiktok: z
          .object({
            privacy_level: z
              .string()
              .optional()
              .describe(
                "PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR or SELF_ONLY — " +
                  "must be one the account allows. Default PUBLIC_TO_EVERYONE.",
              ),
            disable_comment: z.boolean().optional(),
            disable_duet: z.boolean().optional().describe("Video only."),
            disable_stitch: z.boolean().optional().describe("Video only."),
            brand_organic_toggle: z
              .boolean()
              .optional()
              .describe("Promotes the creator's own brand."),
            brand_content_toggle: z
              .boolean()
              .optional()
              .describe("Paid partnership / branded content. Not allowed with SELF_ONLY."),
            is_aigc: z.boolean().optional().describe("Label the post as AI-generated."),
            auto_add_music: z.boolean().optional().describe("Photo posts only."),
            photo_cover_index: z.number().int().min(0).optional().describe("Photo posts: cover image index."),
            video_cover_timestamp_ms: z
              .number()
              .int()
              .min(0)
              .optional()
              .describe("Video posts: cover frame time in ms. Default 1000."),
          })
          .optional()
          .describe("TikTok settings (applies to tiktok accounts)."),
        youtube: z
          .object({
            privacy_status: z.enum(["public", "private", "unlisted"]).optional(),
            tags: z.array(z.string()).optional(),
            category_id: z.string().optional(),
            made_for_kids: z.boolean().optional(),
          })
          .optional()
          .describe("YouTube upload settings (applies to google accounts)."),
        pinterest: z
          .object({
            board_id: z
              .string()
              .optional()
              .describe("Board to pin to. Defaults to the account's first board."),
            title: z.string().max(100).optional().describe("Pin title (max 100)."),
            link: z.string().url().optional().describe("Destination link opened from the pin."),
          })
          .optional()
          .describe("Pinterest pin settings (applies to pinterest accounts)."),
      },
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const overrides = new Map(
        (args.accountOverrides ?? []).map((o) => [o.id, o]),
      );
      const accounts = args.accountIds.map((id) => {
        const o = overrides.get(id);
        return {
          id,
          ...(o?.title ?? args.title ? { title: o?.title ?? args.title } : {}),
          ...(o?.customCaption ? { customCaption: o.customCaption } : {}),
        };
      });
      const body: Record<string, unknown> = {
        caption: args.caption,
        accounts,
      };

      if (args.mediaType === "video" && args.mediaUrl) {
        body.media = {
          type: "video",
          url: args.mediaUrl,
          ...(args.coverUrl ? { cover_url: args.coverUrl } : {}),
        };
      } else if (args.mediaType === "slideshow" && args.mediaUrls?.length) {
        body.media = { type: "slideshow", urls: args.mediaUrls };
      } else if (args.mediaType === "none") {
        body.media = null;
      }

      if (args.scheduled_at) body.scheduled_at = args.scheduled_at;
      if (args.timezone) body.timezone = args.timezone;
      if (args.external_id) body.external_id = args.external_id;

      const settings: Record<string, unknown> = {};
      if (args.instagram && Object.keys(args.instagram).length) settings.instagram = args.instagram;
      if (args.tiktok && Object.keys(args.tiktok).length) settings.tiktok = args.tiktok;
      if (args.youtube && Object.keys(args.youtube).length) settings.youtube = args.youtube;
      if (args.pinterest && Object.keys(args.pinterest).length) settings.pinterest = args.pinterest;
      if (Object.keys(settings).length) body.settings = settings;

      const created = await unsora.request<{ data?: { id?: string } }>(
        "POST",
        "/posts",
        { body, idempotencyKey: args.external_id },
      );

      if (!args.publishNow || args.scheduled_at) return jsonResult(created);

      const postId = created.data?.id;
      if (!postId) {
        throw new Error(
          `Post was created but no id came back to publish it: ${JSON.stringify(created)}`,
        );
      }
      const published = await unsora.request(
        "POST",
        `/posts/${encodeURIComponent(postId)}/publish`,
      );
      return jsonResult({ created, published });
    },
  );

  registerAppTool(
    server,
    "compose_post",
    {
      title: "Compose Post",
      description:
        "Open the interactive post composer: the user picks accounts, edits the caption and " +
        "media, sets per-platform options (YouTube title/visibility/category/tags, TikTok " +
        "privacy/comments/duet/stitch/branded content/AI label, Pinterest board/title/link, " +
        "video cover) and posts now, schedules or saves a draft — the composer creates the " +
        "post itself. Use it whenever the user wants to create or schedule a post and the host " +
        "can show apps; prefill everything the user already gave (caption, media URLs, " +
        "accounts, time). After it opens, do NOT call create_post yourself; tell the user to " +
        "finish in the composer. In hosts without app support, gather the details in chat " +
        "and call create_post instead.",
      inputSchema: {
        caption: z.string().optional(),
        mediaType: z
          .enum(["video", "images", "text"])
          .optional()
          .describe("video = one video, images = one or more images (slideshow), text = no media."),
        mediaUrls: z
          .array(z.string().url())
          .optional()
          .describe("Media to post: one video URL, or image URLs in order."),
        coverUrl: z.string().url().optional().describe("Video cover image URL."),
        accountIds: z
          .array(z.string())
          .optional()
          .describe("Accounts to preselect (ids from get_accounts)."),
        scheduled_at: z.string().optional().describe("ISO datetime to preselect for scheduling."),
        title: z.string().optional().describe("YouTube video title / Pinterest pin title."),
      },
      _meta: { ui: { resourceUri: COMPOSER_UI_URI } },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const [accounts, subscription] = await Promise.all([
        unsora.request("GET", "/accounts").catch((error: unknown) => ({
          error: error instanceof Error ? error.message : String(error),
        })),
        unsora.request("GET", "/user/subscription").catch(() => null),
      ]);
      const accountList = asObject(accounts).data;
      const count = Array.isArray(accountList) ? accountList.length : 0;
      const structured = {
        prefill: args,
        accounts,
        subscription,
      };
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Composer opened with ${count} connected account(s). The user finishes and ` +
              "submits it in the panel — don't call create_post yourself. In hosts without " +
              "the panel, ask for the details and call create_post. " +
              JSON.stringify(structured),
          },
        ],
        structuredContent: structured,
      };
    },
  );

  registerAppTool(
    server,
    "publish_post",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      title: "Publish Post Now",
      description:
        "Publish a DRAFT or SCHEDULED post to its accounts right now instead of waiting for " +
        "its schedule. Requires paid plan. Publishing runs in the background: this returns " +
        "status PUBLISHING straight away. Call get_post after a minute or two to see each " +
        "account's result; if some accounts fail, use retry_post. In app-capable hosts the panel " +
        "tracks publishing live, so don't poll get_post there." + SHOWN_IN_UI,
      inputSchema: {
        postId: z.string(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "POST",
          `/posts/${encodeURIComponent(args.postId)}/publish`,
        ),
      ),
  );

  registerAppTool(
    server,
    "get_post_analytics",
    {
      _meta: { ui: { resourceUri: ANALYTICS_UI_URI } },
      title: "Post Analytics",
      description:
        "Performance of the user's published posts (Scheduler Analytics): totals for views, " +
        "likes, comments and shares plus per-platform breakdowns over the last N days. Pass " +
        "refresh: true to pull fresh metrics from the platforms first (slower)." + SHOWN_IN_UI,
      inputSchema: {
        days: z
          .number()
          .int()
          .min(7)
          .max(90)
          .optional()
          .describe("Window in days, 7–90. Default 30."),
        refresh: z.boolean().optional(),
      },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      if (args.refresh) {
        await unsora.request("POST", "/posts/analytics/refresh");
      }
      const q = args.days ? `?days=${args.days}` : "";
      return jsonResult(
        await unsora.request("GET", `/posts/analytics/summary${q}`),
      );
    },
  );

  registerAppTool(
    server,
    "create_image_and_schedule",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      title: "Create Image & Schedule Post",
      description:
        "Generate an image for a social post and schedule it in one step: create image → wait → schedule slideshow post to accounts. If any target account is Instagram, pass aspectRatio 4:5 (or 1:1) — Instagram rejects 9:16 slideshow images." + SHOWN_IN_UI,
      inputSchema: {
        prompt: z.string(),
        caption: z.string(),
        accountIds: z.array(z.string()).min(1).max(10),
        scheduled_at: z.string().optional(),
        model: z.string().optional(),
        aspectRatio: z.string().optional(),
        resolution: z.string().optional(),
      },
    },
    async (args, extra) => {
      const unsora = unsoraFor(resolveUnsora, extra.authInfo);
      const created = await unsora.request<{
        generation: { id: string };
      }>("POST", "/image-generations/create", {
        body: {
          prompt: args.prompt,
          model: args.model,
          aspectRatio: args.aspectRatio,
          resolution: args.resolution,
        },
      });

      const finished = await unsora.pollImageStatus(created.generation.id);
      const outputUrl = finished.data?.outputUrl;
      if (!outputUrl) {
        throw new Error(
          `Image job failed or missing outputUrl: ${JSON.stringify(finished)}`,
        );
      }

      const post = await unsora.request("POST", "/posts", {
        body: {
          caption: args.caption,
          accounts: args.accountIds.map((id) => ({ id })),
          media: { type: "slideshow", urls: [outputUrl] },
          ...(args.scheduled_at ? { scheduled_at: args.scheduled_at } : {}),
        },
      });

      return jsonResult({
        imageJob: finished,
        post,
        outputUrl,
      });
    },
  );

  registerAppTool(
    server,
    "retry_post",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      title: "Retry Post",
      description:
        "Retry a FAILED or PARTIALLY_PUBLISHED post. Re-attempts only the accounts that failed; already-published accounts are never re-posted. Runs in the background: call get_post after a minute or two for the outcome (in app-capable hosts the panel tracks it live)." + SHOWN_IN_UI,
      inputSchema: {
        postId: z.string(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "POST",
          `/posts/${args.postId}/retry`,
        ),
      ),
  );

  registerAppTool(
    server,
    "upload_file",
    {
      _meta: { ui: { resourceUri: LIBRARY_UI_URI } },
      title: "Upload File",
      description:
        "Upload media to the user's Unsora library (available to every authenticated user). " +
        "Pass a public source URL (preferred) or a base64 payload for small files (≤ ~7MB). " +
        "The file is stored and recorded as an upload asset; the returned url can be used " +
        "anywhere a media URL is accepted (create_post media, reference images, clipping input)." + SHOWN_IN_UI,
      inputSchema: {
        url: z
          .string()
          .url()
          .optional()
          .describe("Public http(s) URL of the file to import (max 200MB)."),
        base64: z
          .string()
          .optional()
          .describe(
            "Base64 file contents (raw or data: URL). Use only for small files; prefer url.",
          ),
        fileName: z
          .string()
          .optional()
          .describe("File name (required with base64, optional with url)."),
        contentType: z
          .string()
          .optional()
          .describe("MIME type override, e.g. image/png."),
      },
    },
    async (args, extra) => {
      if (!args.url && !args.base64) {
        throw new Error("Provide either url or base64");
      }
      const body: Record<string, unknown> = {};
      if (args.url) body.url = args.url;
      if (args.base64) body.base64 = args.base64;
      if (args.fileName) body.fileName = args.fileName;
      if (args.contentType) body.contentType = args.contentType;

      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "POST",
          "/uploads",
          { body },
        ),
      );
    },
  );

  registerAppTool(
    server,
    "list_uploads",
    {
      _meta: { ui: { resourceUri: LIBRARY_UI_URI } },
      annotations: READ_ONLY,
      title: "List Uploads",
      description:
        "List the user's uploaded media assets (from upload_file or the app)." + SHOWN_IN_UI,
      inputSchema: {
        page: z.number().int().optional(),
        limit: z.number().int().max(100).optional(),
      },
    },
    async (args, extra) => {
      const params = new URLSearchParams();
      if (args.page) params.set("page", String(args.page));
      if (args.limit) params.set("limit", String(args.limit));
      const q = params.toString();
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `/uploads${q ? `?${q}` : ""}`,
        ),
      );
    },
  );

  registerAppTool(
    server,
    "get_post",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      annotations: READ_ONLY,
      title: "Get Post",
      description:
        "Fetch one post by id, including per-account publish status and media." + SHOWN_IN_UI,
      inputSchema: {
        postId: z.string(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `/posts/${encodeURIComponent(args.postId)}`,
        ),
      ),
  );

  registerAppTool(
    server,
    "update_post",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      title: "Update Post",
      description:
        "Edit a DRAFT or SCHEDULED post (published posts cannot be edited). " +
        "Only the fields you pass change. Passing scheduled_at reschedules; " +
        "passing scheduled_at: null converts it back to a draft. " +
        "Passing accounts replaces the full target account list." + SHOWN_IN_UI,
      inputSchema: {
        postId: z.string(),
        caption: z.string().optional(),
        scheduled_at: z
          .string()
          .nullable()
          .optional()
          .describe("ISO datetime to (re)schedule, or null to unschedule."),
        timezone: z.string().optional(),
        accountIds: z
          .array(z.string())
          .min(1)
          .max(10)
          .optional()
          .describe("Replaces the post's target accounts."),
      },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = {};
      if (args.caption !== undefined) body.mainCaption = args.caption;
      if (args.scheduled_at !== undefined) body.scheduledFor = args.scheduled_at;
      if (args.timezone !== undefined) body.timezone = args.timezone;
      if (args.accountIds !== undefined) {
        body.accounts = args.accountIds.map((accountId) => ({ accountId }));
      }
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "PUT",
          `/posts/${encodeURIComponent(args.postId)}`,
          { body },
        ),
      );
    },
  );

  registerAppTool(
    server,
    "delete_post",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      title: "Delete Post",
      description:
        "Delete a post. Does not remove already-published content from the platforms." + SHOWN_IN_UI,
      inputSchema: {
        postId: z.string(),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "DELETE",
          `/posts/${encodeURIComponent(args.postId)}`,
        ),
      ),
  );

  server.registerTool(
    "upload-skill",
    {
      title: "Upload Skill",
      description:
        "ADMIN ONLY — upload a skill to the Unsora skills catalog and write its full landing " +
        "page content (tagline, highlights, how-it-works steps, example prompts, requirements, " +
        "CTA copy, install command). Pass the raw SKILL.md content (frontmatter " +
        "name/description is parsed automatically; explicit arguments override it). Created as " +
        "DRAFT unless status is PUBLISHED. Non-admin accounts get a 403.",
      inputSchema: {
        skillMd: z
          .string()
          .describe(
            "Raw SKILL.md content, including the --- frontmatter block with name/description.",
          ),
        name: z
          .string()
          .optional()
          .describe("Skill name. Defaults to the SKILL.md frontmatter name."),
        slug: z
          .string()
          .optional()
          .describe("URL slug. Defaults to a slugified name."),
        tagline: z
          .string()
          .optional()
          .describe("Short one-liner shown under the skill name."),
        description: z
          .string()
          .optional()
          .describe("Defaults to the SKILL.md frontmatter description."),
        installCommand: z
          .string()
          .optional()
          .describe("Command shown on the page to install the skill (e.g. a curl of SKILL.md)."),
        highlights: z
          .array(z.string())
          .optional()
          .describe("Bullet points of what the skill does."),
        steps: z
          .array(
            z.object({
              num: z.string().describe('Step number label, e.g. "1"'),
              title: z.string(),
              body: z.string(),
            }),
          )
          .optional()
          .describe("How-it-works steps shown on the page."),
        examples: z
          .array(z.string())
          .optional()
          .describe("Example prompts users can try with the skill."),
        requirements: z
          .array(z.string())
          .optional()
          .describe("What the user needs before using the skill."),
        ctaHeadline: z.string().optional().describe("Call-to-action headline."),
        ctaBody: z.string().optional().describe("Call-to-action body copy."),
        status: z
          .enum(["DRAFT", "PUBLISHED"])
          .optional()
          .describe("DRAFT (default) or PUBLISHED (immediately live on the landing site)."),
      },
    },
    async (args, extra) => {
      const body: Record<string, unknown> = { skillMd: args.skillMd };
      if (args.name) body.name = args.name;
      if (args.slug) body.slug = args.slug;
      if (args.tagline) body.tagline = args.tagline;
      if (args.description) body.description = args.description;
      if (args.installCommand) body.installCommand = args.installCommand;
      if (args.highlights?.length) body.highlights = args.highlights;
      if (args.steps?.length) body.steps = args.steps;
      if (args.examples?.length) body.examples = args.examples;
      if (args.requirements?.length) body.requirements = args.requirements;
      if (args.ctaHeadline) body.ctaHeadline = args.ctaHeadline;
      if (args.ctaBody) body.ctaBody = args.ctaBody;
      if (args.status) body.status = args.status;

      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "POST",
          "/skills/upload",
          { body },
        ),
      );
    },
  );

  server.registerTool(
    "get-skill",
    {
      annotations: READ_ONLY,
      title: "Get Skill",
      description:
        "ADMIN ONLY — fetch a skill from the Unsora skills catalog by id or slug. Returns the " +
        "full record (any status) including page content, uploaded files, and attached media. " +
        "Use before update-skill to see the current state. Non-admin accounts get a 403.",
      inputSchema: {
        skill: z.string().describe("Skill id or slug."),
      },
    },
    async (args, extra) =>
      jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `/skills/${encodeURIComponent(args.skill)}`,
        ),
      ),
  );

  server.registerTool(
    "update-skill",
    {
      title: "Update Skill",
      description:
        "ADMIN ONLY — partially update a skill in the Unsora skills catalog by id or slug. " +
        "Only the fields you pass change. Can rewrite any landing page content, replace the " +
        "SKILL.md file, publish/unpublish, and attach showcase media (images/videos) by URL " +
        "via addMedia. Non-admin accounts get a 403.",
      inputSchema: {
        skill: z.string().describe("Skill id or slug to update."),
        skillMd: z
          .string()
          .optional()
          .describe("Replacement SKILL.md content (stored as a new version)."),
        name: z.string().optional(),
        slug: z.string().optional().describe("New URL slug."),
        tagline: z.string().optional(),
        description: z.string().optional(),
        installCommand: z.string().optional(),
        highlights: z
          .array(z.string())
          .optional()
          .describe("Replaces the whole highlights list."),
        steps: z
          .array(
            z.object({
              num: z.string().describe('Step number label, e.g. "1"'),
              title: z.string(),
              body: z.string(),
            }),
          )
          .optional()
          .describe("Replaces the whole how-it-works steps list."),
        examples: z
          .array(z.string())
          .optional()
          .describe("Replaces the whole example prompts list."),
        requirements: z
          .array(z.string())
          .optional()
          .describe("Replaces the whole requirements list."),
        ctaHeadline: z.string().optional(),
        ctaBody: z.string().optional(),
        status: z
          .enum(["DRAFT", "PUBLISHED"])
          .optional()
          .describe("Publish or unpublish the skill."),
        addMedia: z
          .array(
            z.object({
              url: z
                .string()
                .url()
                .describe(
                  "Public URL of the image/video (e.g. an Unsora generation outputUrl).",
                ),
              type: z.enum(["IMAGE", "VIDEO"]),
              label: z.string().optional(),
              aspect: z
                .enum(["9/16", "1/1", "16/9"])
                .optional()
                .describe("CSS aspect ratio of the asset. Default 9/16."),
            }),
          )
          .optional()
          .describe(
            "Showcase media to ATTACH to the skill page (appended, nothing is removed).",
          ),
      },
    },
    async (args, extra) => {
      const { skill, ...rest } = args;
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) body[key] = value;
      }
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "PATCH",
          `/skills/${encodeURIComponent(skill)}`,
          { body },
        ),
      );
    },
  );

  registerAppTool(
    server,
    "list_posts",
    {
      _meta: { ui: { resourceUri: POSTS_UI_URI } },
      annotations: READ_ONLY,
      title: "List Posts",
      description:
        "List the user's posts, newest first: drafts, scheduled, publishing, published and " +
        "failed. Filter with status (DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, " +
        "PARTIALLY_PUBLISHED or FAILED)." + SHOWN_IN_UI,
      inputSchema: {
        status: z
          .enum(["DRAFT", "SCHEDULED", "PUBLISHING", "PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"])
          .optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args, extra) => {
      const params = new URLSearchParams();
      if (args.status) params.set("status", args.status);
      if (args.page) params.set("page", String(args.page));
      if (args.limit) params.set("limit", String(args.limit));
      const q = params.toString();
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `/posts${q ? `?${q}` : ""}`,
        ),
      );
    },
  );

  registerAppTool(
    server,
    "list_generations",
    {
      _meta: { ui: { resourceUri: LIBRARY_UI_URI } },
      annotations: READ_ONLY,
      title: "List Generations",
      description:
        "Browse the user's past results for one feature, newest first, with status and " +
        "output URLs: image, video, music, voiceover, influencer, thumbnail, clipping, " +
        "image_upscale, video_upscale, watermark_removal, motion_control, avatar, " +
        "movie_material, voice_change. Use it to find something made earlier (e.g. to post " +
        "or reuse it). Uploaded files are in list_uploads." + SHOWN_IN_UI,
      inputSchema: {
        type: z.enum(LIBRARY_TYPES),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args, extra) => {
      const params = new URLSearchParams();
      if (args.page) params.set("page", String(args.page));
      if (args.limit) params.set("limit", String(args.limit));
      const q = params.toString();
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "GET",
          `${LIBRARY[args.type].list}${q ? `?${q}` : ""}`,
        ),
      );
    },
  );

  registerAppTool(
    server,
    "delete_generation",
    {
      _meta: { ui: { resourceUri: LIBRARY_UI_URI } },
      title: "Delete Generation",
      description:
        "Permanently delete one result from the user's library (type + id from " +
        "list_generations), or an uploaded file (type upload, id from list_uploads). " +
        "Confirm with the user first — this cannot be undone." + SHOWN_IN_UI,
      inputSchema: {
        type: z.enum([...LIBRARY_TYPES, "upload"]),
        id: z.string(),
      },
      annotations: { destructiveHint: true },
    },
    async (args, extra) => {
      const prefix =
        args.type === "upload" ? "/uploads" : LIBRARY[args.type].item;
      return jsonResult(
        await unsoraFor(resolveUnsora, extra.authInfo).request(
          "DELETE",
          `${prefix}/${encodeURIComponent(args.id)}`,
        ),
      );
    },
  );
}
