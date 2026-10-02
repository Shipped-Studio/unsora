/**
 * Shared building blocks for the admin dashboard controllers.
 *
 * The product spreads "a task the user ran" across ~10 tables (video, image,
 * music, avatar, voice, voice-conversion, clipping, video-processing,
 * transcription, video-export). The admin views need to treat these as a
 * single stream — a unified activity feed, cross-feature counts, status
 * distributions and time series.
 *
 * Rather than fan out 10 Prisma queries and merge in JS (which breaks
 * pagination and sorting), we expose one normalised SQL projection —
 * `FEED_SELECT` — that every table maps onto with identical columns:
 *
 *   id text | kind text | userId text | status text (UPPER-cased)
 *   credits int | model text? | label text? | error text? | createdAt ts
 *
 * Callers wrap it in a CTE and filter / sort / paginate over the result.
 */

/** Stable list of feature kinds, in display order. */
export const FEED_KINDS = [
  "video",
  "image",
  "music",
  "avatar",
  "voice",
  "voice_conversion",
  "clipping",
  "video_processing",
  "transcription",
  "video_export",
] as const;

export type FeedKind = (typeof FEED_KINDS)[number];

/** Human labels for each kind (used by the client too, but kept here as truth). */
export const FEED_KIND_LABELS: Record<FeedKind, string> = {
  video: "Video Generation",
  image: "Image Generation",
  music: "Music Generation",
  avatar: "AI Avatar",
  voice: "Voice Generation",
  voice_conversion: "Voice Changer",
  clipping: "AI Clipping",
  video_processing: "Video Enhance",
  transcription: "Subtitles / Transcription",
  video_export: "Video Export",
};

/**
 * One SELECT per table, normalised to the same 9 columns. Column identifiers
 * are quoted to preserve Prisma's camelCase column names; enum statuses are
 * cast to text and every status is UPPER-cased so QUEUED/queued unify.
 */
const FEED_PARTS: string[] = [
  `SELECT id, 'video' AS kind, "userId", UPPER("status"::text) AS status,
     COALESCE("creditsUsed",0) AS credits, "model"::text AS model,
     "prompt"::text AS label, "error"::text AS error, "createdAt"
   FROM generations`,
  `SELECT id, 'image', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), "model"::text, "prompt"::text, "error"::text, "createdAt"
   FROM image_generations`,
  `SELECT id, 'music', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), "model"::text, "prompt"::text, "error"::text, "createdAt"
   FROM music_generations`,
  `SELECT id, 'avatar', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), "model"::text, "transcript"::text, "error"::text, "createdAt"
   FROM avatar_generations`,
  `SELECT id, 'voice', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), "model"::text, "text"::text, "error"::text, "createdAt"
   FROM voice_generations`,
  `SELECT id, 'voice_conversion', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), "voiceId"::text, NULL::text, "error"::text, "createdAt"
   FROM voice_conversions`,
  `SELECT id, 'clipping', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), NULL::text, NULL::text, "error"::text, "createdAt"
   FROM ai_clippings`,
  `SELECT id, 'video_processing', "userId", UPPER("status"::text),
     COALESCE("creditsUsed",0), "upscaleModel"::text, "originalName"::text, "error"::text, "createdAt"
   FROM processed_videos`,
  `SELECT id, 'transcription', "userId", UPPER("status"::text),
     0, NULL::text, "title"::text, "error"::text, "createdAt"
   FROM transcriptions`,
  `SELECT id, 'video_export', "userId", UPPER("status"::text),
     0, NULL::text, NULL::text, "error"::text, "createdAt"
   FROM video_exports`,
];

/** The full UNION ALL projection. Wrap it in a CTE: `WITH feed AS (${FEED_SELECT})`. */
export const FEED_SELECT = FEED_PARTS.join("\n  UNION ALL\n  ");

/** Coerce a value to a bounded positive integer with a fallback. */
export function toPositiveInt(v: unknown, fallback: number, max: number): number {
  const n = parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Postgres COUNT/SUM come back as BigInt via Prisma raw — coerce to number. */
export function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
