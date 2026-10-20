import { WavespeedAPI, getWavespeedClient } from "./wavespeed-api";
import { uploadUrlToStorage } from "./upload";

/**
 * B-roll footage for the subtitle editor, as in Submagic's B-rolls tab:
 * stock clips from Pexels (Free and Premium) and AI images (Trendy).
 */

export type BrollKind = "video" | "image";
export type BrollVendor = "pexels" | "ai" | "upload";
export type VideoType = "free" | "premium" | "trendy";

export interface BrollMedia {
  kind: BrollKind;
  url: string;
  thumbnailUrl?: string;
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

const PEXELS_API = "https://api.pexels.com";

export class PexelsNotConfiguredError extends Error {
  constructor() {
    super("PEXELS_API_KEY is not set");
  }
}

function pexelsKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new PexelsNotConfiguredError();
  return key;
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string | null;
  file_type: string;
}

interface PexelsVideo {
  url: string;
  image: string;
  duration: number;
  width: number;
  height: number;
  user?: { name?: string };
  video_files: PexelsVideoFile[];
}

interface PexelsPhoto {
  url: string;
  width: number;
  height: number;
  photographer?: string;
  src: { large2x: string; large: string; medium: string };
}

/** Picks the MP4 closest to `target` pixels on the short edge, never far above. */
function pickFile(files: PexelsVideoFile[], target: number): PexelsVideoFile | undefined {
  const mp4 = files.filter((f) => f.file_type === "video/mp4" && f.link);
  const edge = (f: PexelsVideoFile) => Math.min(f.width, f.height);
  return [...mp4].sort(
    (a, b) => Math.abs(edge(a) - target) - Math.abs(edge(b) - target),
  )[0];
}

/** Stock videos for a search. Premium asks for sharper files. */
export async function searchPexelsVideos(
  query: string,
  orientation: Orientation,
  options: { perPage?: number; premium?: boolean } = {},
): Promise<BrollMedia[]> {
  const params = new URLSearchParams({
    query,
    orientation,
    per_page: String(options.perPage ?? 12),
    size: options.premium ? "large" : "medium",
  });
  const response = await fetch(`${PEXELS_API}/videos/search?${params}`, {
    headers: { Authorization: pexelsKey() },
  });
  if (!response.ok) throw new Error(`Pexels search failed: HTTP ${response.status}`);
  const { videos } = (await response.json()) as { videos: PexelsVideo[] };
  const target = options.premium ? 2160 : 1080;
  return videos.flatMap((video) => {
    const file = pickFile(video.video_files, target);
    return file
      ? [
          {
            kind: "video" as const,
            url: file.link,
            thumbnailUrl: video.image,
            width: file.width,
            height: file.height,
            duration: video.duration,
            vendor: "pexels" as const,
            sourceUrl: video.url,
            author: video.user?.name,
          },
        ]
      : [];
  });
}

export async function searchPexelsPhotos(
  query: string,
  orientation: Orientation,
  perPage = 12,
): Promise<BrollMedia[]> {
  const params = new URLSearchParams({ query, orientation, per_page: String(perPage) });
  const response = await fetch(`${PEXELS_API}/v1/search?${params}`, {
    headers: { Authorization: pexelsKey() },
  });
  if (!response.ok) throw new Error(`Pexels search failed: HTTP ${response.status}`);
  const { photos } = (await response.json()) as { photos: PexelsPhoto[] };
  return photos.map((photo) => ({
    kind: "image",
    url: photo.src.large2x,
    thumbnailUrl: photo.src.medium,
    width: photo.width,
    height: photo.height,
    vendor: "pexels",
    sourceUrl: photo.url,
    author: photo.photographer,
  }));
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
      const found = await searchPexelsVideos(scene.brollQuery, orientation, {
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
