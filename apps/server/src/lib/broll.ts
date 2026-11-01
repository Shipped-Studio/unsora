import { WavespeedAPI, getWavespeedClient } from "./wavespeed-api";
import { uploadUrlToStorage } from "./upload";

/**
 * B-roll footage for the subtitle editor, as in Submagic's B-rolls tab:
 * stock clips and photos from Pixabay (Free and Premium) and AI images (Trendy).
 */

export type BrollKind = "video" | "image";
/** "pexels" is kept for clips saved before the switch to Pixabay. */
export type BrollVendor = "pixabay" | "pexels" | "ai" | "upload";
export type VideoType = "free" | "premium" | "trendy";

export interface BrollMedia {
  kind: BrollKind;
  url: string;
  thumbnailUrl?: string;
  /** A smaller file for previewing a video before it's picked; `url` is what's used. */
  previewUrl?: string;
  width?: number;
  height?: number;
  /** Seconds, for videos. */
  duration?: number;
  vendor: BrollVendor;
  /** The page to credit, for stock footage. */
  sourceUrl?: string;
  author?: string;
}

export type Orientation = "portrait" | "landscape" | "square";

// ── Pixabay ──────────────────────────────────────────────────────────────
//
// The rules from https://pixabay.com/api/docs/ that shape this code:
// - Requests must be cached for 24 hours; the limit is 100 requests a minute.
// - Image URLs may only be shown temporarily, as search results. An image a
//   user puts in a video is copied to our storage first (importStockImage).
// - Videos may be embedded directly, so their Pixabay URLs are kept.
// - Wherever results are shown, say they come from Pixabay (the client does).

const PIXABAY_API = "https://pixabay.com/api";
/** Pixabay rejects longer queries. */
const MAX_QUERY_LENGTH = 100;
/** Pixabay asks that searches be cached for this long. */
const CACHE_MS = 24 * 60 * 60 * 1000;
/** Searches kept in memory; the oldest is dropped past this. */
const CACHE_MAX_ENTRIES = 1000;

export class PixabayNotConfiguredError extends Error {
  constructor() {
    super("PIXABAY_API_KEY is not set");
  }
}

/** Over Pixabay's 100 requests a minute; resets within the minute. */
export class StockRateLimitError extends Error {
  constructor() {
    super("Pixabay rate limit exceeded");
  }
}

/** The URL to copy wasn't a Pixabay image. */
export class InvalidStockUrlError extends Error {
  constructor() {
    super("Not a Pixabay image URL");
  }
}

function pixabayKey(): string {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new PixabayNotConfiguredError();
  return key;
}

const cache = new Map<string, { at: number; data: unknown }>();

/** A Pixabay search, cached for 24 hours as Pixabay requires. */
async function pixabaySearch<T>(
  endpoint: "images" | "videos",
  params: Record<string, string>,
): Promise<T> {
  const query = new URLSearchParams({ ...params, safesearch: "true" });
  // The key isn't part of the cache key, so rotating it keeps the cache.
  const cacheKey = `${endpoint}?${query}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;

  query.set("key", pixabayKey());
  const path = endpoint === "videos" ? "/videos/" : "/";
  const response = await fetch(`${PIXABAY_API}${path}?${query}`);
  if (response.status === 429) throw new StockRateLimitError();
  if (!response.ok) throw new Error(`Pixabay search failed: HTTP ${response.status}`);
  const data = (await response.json()) as T;

  cache.delete(cacheKey);
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

interface PixabayVideoFile {
  /** Empty when Pixabay has no file at this size (only ever "large"). */
  url: string;
  width: number;
  height: number;
  size: number;
  thumbnail: string;
}

interface PixabayVideo {
  pageURL: string;
  duration: number;
  user: string;
  videos: Record<"large" | "medium" | "small" | "tiny", PixabayVideoFile>;
}

interface PixabayImage {
  pageURL: string;
  /** Up to 640px. Valid for 24 hours: for showing results only. */
  webformatURL: string;
  /** Up to 1280px on the long edge. */
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
}

/** Largest edge of `largeImageURL`. */
const LARGE_IMAGE_EDGE = 1280;

function orientationOf(width: number, height: number): Orientation {
  const ratio = width / height;
  if (ratio > 0.9 && ratio < 1.1) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

/** The file closest to `target` pixels on its short edge. */
function pickFile(video: PixabayVideo, target: number): PixabayVideoFile | undefined {
  const files = Object.values(video.videos).filter((file) => file?.url);
  const edge = (f: PixabayVideoFile) => Math.min(f.width, f.height);
  return files.sort((a, b) => Math.abs(edge(a) - target) - Math.abs(edge(b) - target))[0];
}

/**
 * Stock videos for a search. Premium asks for sharper files.
 *
 * Pixabay can't filter videos by orientation and most of its footage is
 * landscape, so clips in the wanted orientation come first and the rest
 * follow; the editor's layouts crop them to the frame.
 */
export async function searchStockVideos(
  query: string,
  orientation: Orientation,
  options: { perPage?: number; premium?: boolean } = {},
): Promise<BrollMedia[]> {
  const perPage = options.perPage ?? 12;
  const { hits } = await pixabaySearch<{ hits: PixabayVideo[] }>("videos", {
    q: query.slice(0, MAX_QUERY_LENGTH),
    // Fetch extra, so there's room to put the right orientation first.
    per_page: String(Math.min(200, Math.max(20, perPage * 3))),
  });
  const target = options.premium ? 2160 : 1080;
  const media = hits.flatMap((video): BrollMedia[] => {
    const file = pickFile(video, target);
    if (!file) return [];
    return [
      {
        kind: "video",
        url: file.url,
        thumbnailUrl: file.thumbnail || video.videos.medium?.thumbnail,
        // The smallest file (about 960x540) streams quickly for previews.
        previewUrl: video.videos.tiny?.url || video.videos.small?.url || file.url,
        width: file.width,
        height: file.height,
        duration: video.duration,
        vendor: "pixabay",
        sourceUrl: video.pageURL,
        author: video.user,
      },
    ];
  });
  const fits = (m: BrollMedia) => orientationOf(m.width ?? 1, m.height ?? 1) === orientation;
  return [...media.filter(fits), ...media.filter((m) => !fits(m))].slice(0, perPage);
}

const IMAGE_ORIENTATION: Record<Orientation, string> = {
  portrait: "vertical",
  landscape: "horizontal",
  square: "all",
};

/**
 * Stock photos for a search. Their URLs are only for showing results: an
 * image the user picks is copied to our storage with importStockImage.
 */
export async function searchStockPhotos(
  query: string,
  orientation: Orientation,
  perPage = 12,
): Promise<BrollMedia[]> {
  const { hits } = await pixabaySearch<{ hits: PixabayImage[] }>("images", {
    q: query.slice(0, MAX_QUERY_LENGTH),
    image_type: "photo",
    orientation: IMAGE_ORIENTATION[orientation],
    per_page: String(Math.min(200, Math.max(3, perPage))),
  });
  return hits.map((image) => {
    const scale = Math.min(1, LARGE_IMAGE_EDGE / Math.max(image.imageWidth, image.imageHeight));
    return {
      kind: "image",
      url: image.largeImageURL,
      thumbnailUrl: image.webformatURL,
      width: Math.round(image.imageWidth * scale),
      height: Math.round(image.imageHeight * scale),
      vendor: "pixabay",
      sourceUrl: image.pageURL,
      author: image.user,
    };
  });
}

/** True for https URLs on pixabay.com or its subdomains (e.g. cdn.pixabay.com). */
function isPixabayUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "pixabay.com" || url.hostname.endsWith(".pixabay.com"))
    );
  } catch {
    return false;
  }
}

/**
 * Copies a Pixabay image to our storage and returns its URL there. Pixabay
 * doesn't allow keeping its image URLs in an app, so a picked image is
 * copied once, before it goes in the video. Only Pixabay URLs are accepted,
 * so this can't be used to make the server fetch other addresses.
 */
export async function importStockImage(url: string): Promise<string> {
  if (!isPixabayUrl(url)) throw new InvalidStockUrlError();
  const stored = await uploadUrlToStorage(url, "broll.jpg", "brolls");
  if (!stored.success || !stored.fileUrl) {
    throw new Error(stored.success ? "Upload failed" : stored.error);
  }
  return stored.fileUrl;
}

/** Credits an AI B-roll image costs; the same as Seedream v5 Lite elsewhere. */
export const AI_IMAGE_CREDITS = 2;

const ASPECT: Record<Orientation, string> = {
  portrait: "9:16",
  landscape: "16:9",
  square: "1:1",
};

/** Makes a photographic B-roll still and keeps it in our storage. */
export async function generateBrollImage(
  description: string,
  orientation: Orientation,
): Promise<BrollMedia> {
  const { model, input } = WavespeedAPI.seedreamInput({
    prompt: `Cinematic B-roll still for a short video: ${description}. Photorealistic, natural light, no text, no logos, no watermark.`,
    aspectRatio: ASPECT[orientation],
    resolution: "basic",
    outputFormat: "jpeg",
  });
  const result = await getWavespeedClient().run(model, input);
  const output = result.outputs[0];
  if (result.status !== "completed" || !output) {
    throw new Error(result.error ?? "Image generation failed");
  }
  const stored = await uploadUrlToStorage(output, "broll.jpg", "brolls");
  const url = stored.success && stored.fileUrl ? stored.fileUrl : output;
  return { kind: "image", url, thumbnailUrl: url, vendor: "ai" };
}

// Transitions Auto B-rolls picks from, by family, with the sound each plays.
// One or two families per video keep the cuts consistent.
const TRANSITION_FAMILIES: { id: string; sound: string | null }[][] = [
  [
    { id: "slide-blur-top", sound: "whoosh-long" },
    { id: "slide-blur-bottom", sound: "whoosh-long" },
    { id: "slide-blur-left", sound: "whoosh-long" },
    { id: "slide-blur-right", sound: "whoosh-long" },
  ],
  [
    { id: "zoom-blur-in", sound: "whoosh-long" },
    { id: "zoom-blur-out", sound: "whoosh-long" },
    { id: "shake-blur", sound: "whoosh-long" },
  ],
  [
    { id: "film-burn-3", sound: "film-burn" },
    { id: "light-leak", sound: "light-leak" },
    { id: "photo-vintage", sound: "camera-focus" },
  ],
  [
    { id: "glitch", sound: "glitch" },
    { id: "glitch-2", sound: "glitch" },
    { id: "vhs", sound: "glitch" },
  ],
  [
    { id: "comic", sound: "whoosh-long" },
    { id: "drawer", sound: null },
    { id: "paper-slide", sound: "paper-slide" },
  ],
];

export interface PlannedClip {
  start: number;
  end: number;
  media: BrollMedia;
  transition?: string;
}

export interface PlannedSound {
  start: number;
  sound: string;
}

export interface SceneInput {
  start: number;
  end: number;
  brollQuery: string;
  keyword: string;
}

// A B-roll is on screen at least and at most this long.
const MIN_CLIP_SECONDS = 2;
const MAX_CLIP_SECONDS = 6;
// The opening scene keeps the speaker on screen, as the hook.
const SKIP_FIRST_SCENE = true;

/**
 * Plans B-roll for about `percent` of the video: picks scenes evenly, finds
 * footage for each and adds transitions and their sounds.
 */
export async function planAutoBrolls(options: {
  scenes: SceneInput[];
  duration: number;
  percent: number;
  videoType: VideoType;
  transitions: boolean;
  orientation: Orientation;
}): Promise<{ clips: PlannedClip[]; sounds: PlannedSound[] }> {
  const { scenes, duration, percent, videoType, orientation } = options;
  const target = (Math.min(100, Math.max(0, percent)) / 100) * duration;
  const candidates = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene, index }) =>
      (!SKIP_FIRST_SCENE || index > 0) && scene.end - scene.start >= MIN_CLIP_SECONDS,
    );

  // Spread the picks: take every nth scene until the target is covered.
  const picked: typeof candidates = [];
  let covered = 0;
  const step = Math.max(1, Math.round(candidates.length / Math.max(1, (target / MAX_CLIP_SECONDS) || 1)));
  for (let pass = 0; pass < step && covered < target; pass++) {
    for (let i = pass; i < candidates.length && covered < target; i += step) {
      if (picked.includes(candidates[i])) continue;
      picked.push(candidates[i]);
      const { scene } = candidates[i];
      covered += Math.min(MAX_CLIP_SECONDS, scene.end - scene.start);
    }
  }
  picked.sort((a, b) => a.index - b.index);

  const families = [...TRANSITION_FAMILIES]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .flat();

  const clips: PlannedClip[] = [];
  const sounds: PlannedSound[] = [];
  const used = new Set<string>();
  for (const [n, { scene }] of picked.entries()) {
    const length = Math.min(MAX_CLIP_SECONDS, scene.end - scene.start);
    let media: BrollMedia | undefined;
    if (videoType === "trendy") {
      media = await generateBrollImage(scene.keyword || scene.brollQuery, orientation);
    } else {
      const found = await searchStockVideos(scene.brollQuery, orientation, {
        perPage: 8,
        premium: videoType === "premium",
      });
      media =
        found.find((m) => !used.has(m.url) && (m.duration ?? 0) >= length) ??
        found.find((m) => !used.has(m.url));
    }
    if (!media) continue;
    used.add(media.url);
    const transition = options.transitions ? families[n % families.length] : undefined;
    clips.push({
      start: scene.start,
      end: scene.start + length,
      media,
      transition: transition?.id,
    });
    if (transition?.sound) sounds.push({ start: scene.start, sound: transition.sound });
  }
  return { clips, sounds };
}

/** Credits Auto B-rolls spends: AI images cost, stock footage is included. */
export const autoBrollCredits = (videoType: VideoType, clips: number) =>
  videoType === "trendy" ? clips * AI_IMAGE_CREDITS : 0;
