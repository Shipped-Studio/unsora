import { Supadata } from "@supadata/js";
import { probeVideoMetadata } from "./asset-utils";
import { measureMediaSeconds } from "./media-limits";

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
];

function extractYoutubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

let supadataClient: Supadata | null = null;

function getSupadataClient(): Supadata | null {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;
  if (!supadataClient) {
    supadataClient = new Supadata({ apiKey });
  }
  return supadataClient;
}

/** Parse ISO 8601 durations like PT1H2M3S into seconds. */
function parseIso8601Duration(value: string): number | null {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

async function getYoutubeDurationFromDataApi(
  videoId: string,
): Promise<number | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `[clipping-video-info] YouTube Data API returned ${response.status}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      items?: { contentDetails?: { duration?: string } }[];
    };
    const duration = data.items?.[0]?.contentDetails?.duration;
    return duration ? parseIso8601Duration(duration) : null;
  } catch (error) {
    console.warn(
      "[clipping-video-info] YouTube Data API lookup failed:",
      error,
    );
    return null;
  }
}

async function getYoutubeDurationFromSupadata(
  videoId: string,
): Promise<number | null> {
  const client = getSupadataClient();
  if (!client) return null;

  try {
    const video = await client.youtube.video({ id: videoId });
    return typeof video.duration === "number" && video.duration > 0
      ? video.duration
      : null;
  } catch (error) {
    console.warn("[clipping-video-info] Supadata lookup failed:", error);
    return null;
  }
}

async function getYoutubeDuration(url: string): Promise<number | null> {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;

  return (
    (await getYoutubeDurationFromDataApi(videoId)) ??
    (await getYoutubeDurationFromSupadata(videoId))
  );
}

export async function resolveClippingVideoDuration(
  url: string,
): Promise<number | null> {
  const youtubeDuration = await getYoutubeDuration(url);
  if (youtubeDuration != null) return youtubeDuration;

  // Ranged read of the container header first; the full (capped) download
  // below is only for files that can't be read that way.
  const measured = await measureMediaSeconds(url);
  if (measured) return measured;

  const metadata = await probeVideoMetadata(url);
  if (metadata?.duration && metadata.duration > 0) {
    return metadata.duration;
  }

  return null;
}
