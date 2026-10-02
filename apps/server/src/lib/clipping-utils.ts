import type { GenerationStatus, Prisma } from "@prisma/client";
import prisma from "./db";
import { createAsset } from "./asset-utils";
import { uploadUrlToStorage } from "./upload";
import type { WayinAPI, WayinClip, WayinTaskStatus } from "./wayin-api";

export const WAYIN_TARGET_DURATIONS = [
  "DURATION_0_30",
  "DURATION_0_90",
  "DURATION_30_60",
  "DURATION_60_90",
  "DURATION_90_180",
  "DURATION_180_300",
] as const;

export type WayinTargetDuration = (typeof WAYIN_TARGET_DURATIONS)[number];

const FORM_DURATION_MAP: Record<string, WayinTargetDuration> = {
  auto: "DURATION_0_90",
  lt30: "DURATION_0_30",
  "30-60": "DURATION_30_60",
  "60-90": "DURATION_60_90",
  "90-3min": "DURATION_90_180",
  gt3min: "DURATION_180_300",
};

export function resolveTargetDuration(
  value: unknown,
): WayinTargetDuration | null {
  if (typeof value !== "string" || !value.trim()) {
    return "DURATION_0_90";
  }

  const trimmed = value.trim();
  if (WAYIN_TARGET_DURATIONS.includes(trimmed as WayinTargetDuration)) {
    return trimmed as WayinTargetDuration;
  }

  return FORM_DURATION_MAP[trimmed] ?? null;
}

export const WAYIN_RATIOS = [
  "RATIO_9_16",
  "RATIO_1_1",
  "RATIO_4_5",
  "RATIO_16_9",
] as const;

export type WayinRatio = (typeof WAYIN_RATIOS)[number];

const FORM_RATIO_MAP: Record<string, WayinRatio> = {
  "9:16": "RATIO_9_16",
  "1:1": "RATIO_1_1",
  "4:5": "RATIO_4_5",
  "16:9": "RATIO_16_9",
};

export function resolveClipRatio(
  value: unknown,
): { ratio: WayinRatio | null; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { ratio: null };
  }

  if (typeof value !== "string") {
    return { ratio: null, error: "Invalid ratio" };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "original") {
    return { ratio: null };
  }

  if (WAYIN_RATIOS.includes(trimmed as WayinRatio)) {
    return { ratio: trimmed as WayinRatio };
  }

  const mapped = FORM_RATIO_MAP[trimmed];
  if (!mapped) {
    return {
      ratio: null,
      error: "Invalid ratio. Use 9:16, 1:1, 4:5, 16:9, or original",
    };
  }

  return { ratio: mapped };
}

export const MAX_MOMENTS_QUERY_LENGTH = 500;

/** Validate the optional Find Moments natural-language query. */
export function resolveMomentsQuery(
  value: unknown,
): { query: string | null; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { query: null };
  }

  if (typeof value !== "string") {
    return { query: null, error: "query must be a string" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { query: null };
  }

  if (trimmed.length > MAX_MOMENTS_QUERY_LENGTH) {
    return {
      query: null,
      error: `query must be at most ${MAX_MOMENTS_QUERY_LENGTH} characters`,
    };
  }

  return { query: trimmed };
}

export const MAX_CLIP_LIMIT = 20;

export function resolveClipLimit(
  value: unknown,
): { limit: number | null; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { limit: null };
  }

  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return { limit: null, error: "limit must be a positive integer" };
  }

  if (n > MAX_CLIP_LIMIT) {
    return {
      limit: null,
      error: `limit must be at most ${MAX_CLIP_LIMIT}`,
    };
  }

  return { limit: n };
}

export function mapWayinStatus(status: WayinTaskStatus): GenerationStatus {
  switch (status) {
    case "SUCCEEDED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    case "ONGOING":
      return "PROCESSING";
    default:
      return "QUEUED";
  }
}

const MIRROR_ATTEMPTS = 3;

async function mirrorToStorage(
  sourceUrl: string,
  fileName: string,
  folder: string,
): Promise<string> {
  // Wayin URLs expire, so retry before falling back to the source URL —
  // a failed mirror here means the stored clip link eventually goes dead.
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MIRROR_ATTEMPTS; attempt++) {
    const uploaded = await uploadUrlToStorage(sourceUrl, fileName, folder);
    if (uploaded.success && uploaded.fileUrl) {
      return uploaded.fileUrl;
    }
    lastError = uploaded.error;
    if (attempt < MIRROR_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  console.error(
    `[clipping] Storage upload failed after ${MIRROR_ATTEMPTS} attempts for ${fileName}; storing expiring source URL:`,
    lastError,
  );
  return sourceUrl;
}

/**
 * Wayin's find-moments endpoint ignores the `limit` param and returns every
 * matching moment, so the requested limit has to be enforced app-side.
 * Keeps the top-scoring clips (falling back to idx rank) in stable idx order.
 */
export function limitWayinClips(
  clips: WayinClip[] | undefined,
  limit: number | null | undefined,
): WayinClip[] {
  const all = clips ?? [];
  if (limit == null || all.length <= limit) return all;

  return [...all]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.idx - b.idx)
    .slice(0, limit)
    .sort((a, b) => a.idx - b.idx);
}

export async function syncClippingClips(
  userId: string,
  aiClippingId: string,
  clips: WayinClip[],
  options?: { pruneOthers?: boolean },
) {
  for (const [fallbackOrder, clip] of clips.entries()) {
    const order = typeof clip.idx === "number" ? clip.idx : fallbackOrder;
    const existing = await prisma.aIClippingClip.findFirst({
      where: { aiClippingId, order },
    });

    const clipLabel = clip.title || `Clip ${order + 1}`;

    let thumbnailAssetId = existing?.thumbnailAssetId ?? null;
    if (clip.thumbnail && !thumbnailAssetId) {
      const thumbnailUrl = await mirrorToStorage(
        clip.thumbnail,
        `${clipLabel}-thumb.jpg`,
        "ai-clippings/thumbnails",
      );
      const thumbnailAsset = await createAsset({
        userId,
        url: thumbnailUrl,
        name: `${clipLabel} thumbnail`,
        type: "IMAGE",
        source: "EXPORT",
      });
      thumbnailAssetId = thumbnailAsset.id;
    }

    let outputAssetId = existing?.outputAssetId ?? null;
    if (clip.export_link && !outputAssetId) {
      const videoUrl = await mirrorToStorage(
        clip.export_link,
        `${clipLabel}.mp4`,
        "ai-clippings/videos",
      );
      const outputAsset = await createAsset({
        userId,
        url: videoUrl,
        name: clipLabel,
        type: "VIDEO",
        source: "EXPORT",
        duration: (clip.end_ms - clip.begin_ms) / 1000,
      });
      outputAssetId = outputAsset.id;
    }

    const data = {
      title: clip.title,
      startTime: clip.begin_ms / 1000,
      endTime: clip.end_ms / 1000,
      duration: (clip.end_ms - clip.begin_ms) / 1000,
      status: "COMPLETED" as const,
      thumbnailAssetId,
      outputAssetId,
      metadata: {
        tags: clip.tags ?? [],
        desc: clip.desc ?? null,
        score: clip.score ?? null,
        wayin_thumbnail: clip.thumbnail ?? null,
        wayin_export_link: clip.export_link ?? null,
      },
    };

    if (existing) {
      await prisma.aIClippingClip.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.aIClippingClip.create({
        data: {
          aiClippingId,
          order,
          ...data,
        },
      });
    }
  }

  // Partial (ONGOING) syncs can create rows that fall outside the final
  // clip set — e.g. find-moments returns more clips than the requested
  // limit. On the final sync, drop rows that aren't in the kept set.
  if (options?.pruneOthers && clips.length) {
    const keptOrders = clips.map((clip, i) =>
      typeof clip.idx === "number" ? clip.idx : i,
    );
    await prisma.aIClippingClip.deleteMany({
      where: { aiClippingId, order: { notIn: keptOrders } },
    });
  }
}

/**
 * On-demand refresh shared by the refresh endpoints: checks Wayin detection
 * status (and export status once the queue has started phase 2) and returns
 * the status/metadata to persist.
 *
 * Read-only on purpose: clip syncing (CDN download + storage upload, tens of
 * seconds per clip) is owned by the queue task. Doing it inline here made the
 * refresh endpoint exceed MCP/HTTP client timeouts whenever clips landed.
 *
 * Wayin marks detection tasks SUCCEEDED before any rendering happens, so
 * SUCCEEDED here maps to PROCESSING; only a SUCCEEDED *export* task means the
 * job is COMPLETED.
 */
export async function refreshClippingFromWayin(
  client: WayinAPI,
  clipping: {
    id: string;
    taskId: string | null;
    config: unknown;
    metadata: unknown;
  },
): Promise<{
  status: GenerationStatus;
  error: string | null;
  metadata: Prisma.InputJsonObject;
}> {
  const config = (clipping.config ?? {}) as { query?: string | null };
  const isFindMoments = Boolean(config.query?.trim?.() ?? config.query);
  const priorMeta = (clipping.metadata ?? {}) as Record<string, unknown>;
  const exportTaskId =
    typeof priorMeta.export_task_id === "string"
      ? priorMeta.export_task_id
      : null;

  const detection = await client.getResults(clipping.taskId!, isFindMoments);

  if (detection.status === "FAILED") {
    return {
      status: "FAILED",
      error: detection.error_message || "AI clipping failed",
      metadata: {
        expire_at: detection.expire_at ?? null,
        cost_usage: detection.cost_usage ?? null,
        wayin_status: detection.status,
        export_task_id: exportTaskId,
      },
    };
  }

  if (exportTaskId) {
    const exported = await client.getExportResults(exportTaskId);

    if (exported.status === "FAILED") {
      return {
        status: "FAILED",
        error: exported.error_message || "AI clipping export failed",
        metadata: {
          expire_at: exported.expire_at ?? detection.expire_at ?? null,
          cost_usage: exported.cost_usage ?? detection.cost_usage ?? null,
          wayin_status: exported.status,
          export_task_id: exportTaskId,
        },
      };
    }

    // Export SUCCEEDED still maps to PROCESSING: the queue may not have
    // mirrored the last clips to storage yet, and it is the sole writer of
    // COMPLETED (its final update lands within seconds of this state).
  }

  return {
    status:
      detection.status === "SUCCEEDED"
        ? "PROCESSING"
        : mapWayinStatus(detection.status),
    error: null,
    metadata: {
      expire_at: detection.expire_at ?? null,
      cost_usage: detection.cost_usage ?? null,
      wayin_status: exportTaskId ? "EXPORTING" : detection.status,
      export_task_id: exportTaskId,
    },
  };
}
