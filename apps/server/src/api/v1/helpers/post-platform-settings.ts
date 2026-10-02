export type TikTokPostSettings = {
  post_mode?: "DIRECT_POST" | "MEDIA_UPLOAD";
  privacy_level?: string;
  music_usage_confirmation?: boolean;
  disable_comment?: boolean;
  disable_duet?: boolean;
  disable_stitch?: boolean;
  brand_content_toggle?: boolean;
  brand_organic_toggle?: boolean;
  is_aigc?: boolean;
  auto_add_music?: boolean;
  photo_cover_index?: number;
  video_cover_timestamp_ms?: number;
};

export type InstagramPostSettings = {
  cover_url?: string;
  coverUrl?: string;
};

/** Keys must match YouTubePostSettings consumed by the publisher. */
export type YouTubePostSettings = {
  privacyStatus?: "public" | "private" | "unlisted";
  tags?: string[];
  categoryId?: string;
  madeForKids?: boolean;
};

/** Keys must match PinterestPostSettings consumed by the publisher. */
export type PinterestPostSettings = {
  boardId?: string;
};

export type PlatformSettings = {
  instagram?: InstagramPostSettings;
  tiktok?: TikTokPostSettings;
  youtube?: YouTubePostSettings;
  pinterest?: PinterestPostSettings;
};

/** Public API supports optional settings for these providers only. */
export const SUPPORTED_PLATFORM_SETTING_KEYS = [
  "instagram",
  "tiktok",
  "youtube",
  "pinterest",
] as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const TIKTOK_POST_MODES = new Set(["DIRECT_POST", "MEDIA_UPLOAD"]);

function parseOptionalBoolean(
  value: unknown,
  field: string,
): Result<boolean | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean` };
  }
  return { ok: true, value };
}

function parseOptionalNumber(
  value: unknown,
  field: string,
): Result<number | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: `${field} must be a number` };
  }
  return { ok: true, value };
}

function parseInstagramSettings(
  raw: Record<string, unknown>,
): Result<InstagramPostSettings | undefined> {
  const out: InstagramPostSettings = {};
  if (typeof raw.cover_url === "string" && raw.cover_url.trim()) {
    out.cover_url = raw.cover_url.trim();
  }
  if (typeof raw.coverUrl === "string" && raw.coverUrl.trim()) {
    out.coverUrl = raw.coverUrl.trim();
  }
  if (!out.cover_url && !out.coverUrl) {
    return { ok: true, value: undefined };
  }
  return { ok: true, value: out };
}

function parseTikTokSettings(
  raw: Record<string, unknown>,
): Result<TikTokPostSettings | undefined> {
  const out: TikTokPostSettings = {};

  const postMode = raw.post_mode ?? raw.postMode;
  if (postMode !== undefined) {
    if (typeof postMode !== "string" || !TIKTOK_POST_MODES.has(postMode)) {
      return {
        ok: false,
        error: 'tiktok.post_mode must be "DIRECT_POST" or "MEDIA_UPLOAD"',
      };
    }
    out.post_mode = postMode as TikTokPostSettings["post_mode"];
  }

  const privacy = raw.privacy_level ?? raw.privacyLevel;
  if (privacy !== undefined) {
    if (typeof privacy !== "string" || !privacy.trim()) {
      return { ok: false, error: "tiktok.privacy_level must be a non-empty string" };
    }
    out.privacy_level = privacy.trim();
  }

  const boolFields: [keyof TikTokPostSettings, string, string][] = [
    ["music_usage_confirmation", "music_usage_confirmation", "musicUsageConfirmation"],
    ["disable_comment", "disable_comment", "disableComment"],
    ["disable_duet", "disable_duet", "disableDuet"],
    ["disable_stitch", "disable_stitch", "disableStitch"],
    ["brand_content_toggle", "brand_content_toggle", "brandContentToggle"],
    ["brand_organic_toggle", "brand_organic_toggle", "brandOrganicToggle"],
    ["is_aigc", "is_aigc", "isAigc"],
    ["auto_add_music", "auto_add_music", "autoAddMusic"],
  ];

  for (const [key, snake, camel] of boolFields) {
    const rawValue = raw[snake] ?? raw[camel];
    const parsed = parseOptionalBoolean(rawValue, `tiktok.${snake}`);
    if (!parsed.ok) return parsed;
    if (parsed.value !== undefined) {
      (out as Record<string, boolean>)[key] = parsed.value;
    }
  }

  const coverIndex = parseOptionalNumber(
    raw.photo_cover_index ?? raw.photoCoverIndex,
    "tiktok.photo_cover_index",
  );
  if (!coverIndex.ok) return coverIndex;
  if (coverIndex.value !== undefined) out.photo_cover_index = coverIndex.value;

  const coverTs = parseOptionalNumber(
    raw.video_cover_timestamp_ms ?? raw.videoCoverTimestampMs,
    "tiktok.video_cover_timestamp_ms",
  );
  if (!coverTs.ok) return coverTs;
  if (coverTs.value !== undefined) {
    out.video_cover_timestamp_ms = coverTs.value;
  }

  if (Object.keys(out).length === 0) {
    return { ok: true, value: undefined };
  }
  return { ok: true, value: out };
}

const YOUTUBE_PRIVACY_STATUSES = new Set(["public", "private", "unlisted"]);

function parseYouTubeSettings(
  raw: Record<string, unknown>,
): Result<YouTubePostSettings | undefined> {
  const out: YouTubePostSettings = {};

  const privacy = raw.privacy_status ?? raw.privacyStatus;
  if (privacy !== undefined) {
    if (typeof privacy !== "string" || !YOUTUBE_PRIVACY_STATUSES.has(privacy)) {
      return {
        ok: false,
        error:
          'youtube.privacy_status must be "public", "private", or "unlisted"',
      };
    }
    out.privacyStatus = privacy as YouTubePostSettings["privacyStatus"];
  }

  if (raw.tags !== undefined) {
    if (
      !Array.isArray(raw.tags) ||
      raw.tags.some((t) => typeof t !== "string" || !t.trim())
    ) {
      return {
        ok: false,
        error: "youtube.tags must be an array of non-empty strings",
      };
    }
    out.tags = (raw.tags as string[]).map((t) => t.trim());
  }

  const categoryId = raw.category_id ?? raw.categoryId;
  if (categoryId !== undefined) {
    if (typeof categoryId !== "string" || !categoryId.trim()) {
      return { ok: false, error: "youtube.category_id must be a non-empty string" };
    }
    out.categoryId = categoryId.trim();
  }

  const madeForKids = parseOptionalBoolean(
    raw.made_for_kids ?? raw.madeForKids,
    "youtube.made_for_kids",
  );
  if (!madeForKids.ok) return madeForKids;
  if (madeForKids.value !== undefined) out.madeForKids = madeForKids.value;

  if (Object.keys(out).length === 0) {
    return { ok: true, value: undefined };
  }
  return { ok: true, value: out };
}

function parsePinterestSettings(
  raw: Record<string, unknown>,
): Result<PinterestPostSettings | undefined> {
  const boardId = raw.board_id ?? raw.boardId;
  if (boardId === undefined) return { ok: true, value: undefined };
  if (typeof boardId !== "string" || !boardId.trim()) {
    return { ok: false, error: "pinterest.board_id must be a non-empty string" };
  }
  return { ok: true, value: { boardId: boardId.trim() } };
}

function rejectUnknownPlatformKeys(
  obj: Record<string, unknown>,
  location: string,
): Result<void> {
  const unknown = Object.keys(obj).filter(
    (k) =>
      !SUPPORTED_PLATFORM_SETTING_KEYS.includes(
        k as (typeof SUPPORTED_PLATFORM_SETTING_KEYS)[number],
      ),
  );
  if (unknown.length === 0) return { ok: true, value: undefined };
  return {
    ok: false,
    error: `Unsupported ${location} key(s): ${unknown.join(", ")}. Supported: ${SUPPORTED_PLATFORM_SETTING_KEYS.join(", ")}`,
  };
}

/** Merge `settings` with optional top-level `instagram` / `tiktok` (partner-style). */
export function parsePlatformSettings(
  body: Record<string, unknown>,
): Result<PlatformSettings | undefined> {
  const merged: PlatformSettings = {};
  const settingsRoot = isPlainObject(body.settings) ? body.settings : {};

  const settingsKeysCheck = rejectUnknownPlatformKeys(
    settingsRoot,
    "settings",
  );
  if (!settingsKeysCheck.ok) return settingsKeysCheck;

  for (const key of SUPPORTED_PLATFORM_SETTING_KEYS) {
    const topLevel = body[key];
    if (topLevel !== undefined && !isPlainObject(topLevel)) {
      return {
        ok: false,
        error: `"${key}" must be an object when provided`,
      };
    }
  }

  const instagramRaw = isPlainObject(settingsRoot.instagram)
    ? settingsRoot.instagram
    : isPlainObject(body.instagram)
      ? body.instagram
      : null;
  if (instagramRaw) {
    const parsed = parseInstagramSettings(instagramRaw);
    if (!parsed.ok) return parsed;
    if (parsed.value) merged.instagram = parsed.value;
  }

  const tiktokRaw = isPlainObject(settingsRoot.tiktok)
    ? settingsRoot.tiktok
    : isPlainObject(body.tiktok)
      ? body.tiktok
      : null;
  if (tiktokRaw) {
    const parsed = parseTikTokSettings(tiktokRaw);
    if (!parsed.ok) return parsed;
    if (parsed.value) merged.tiktok = parsed.value;
  }

  const youtubeRaw = isPlainObject(settingsRoot.youtube)
    ? settingsRoot.youtube
    : isPlainObject(body.youtube)
      ? body.youtube
      : null;
  if (youtubeRaw) {
    const parsed = parseYouTubeSettings(youtubeRaw);
    if (!parsed.ok) return parsed;
    if (parsed.value) merged.youtube = parsed.value;
  }

  const pinterestRaw = isPlainObject(settingsRoot.pinterest)
    ? settingsRoot.pinterest
    : isPlainObject(body.pinterest)
      ? body.pinterest
      : null;
  if (pinterestRaw) {
    const parsed = parsePinterestSettings(pinterestRaw);
    if (!parsed.ok) return parsed;
    if (parsed.value) merged.pinterest = parsed.value;
  }

  if (Object.keys(merged).length === 0) {
    return { ok: true, value: undefined };
  }
  return { ok: true, value: merged };
}

/**
 * Per linked-account JSON for PostAccount.settings (one provider per row).
 * TikTok rows get tiktok options; Instagram rows get instagram options.
 */
export function postAccountSettingsForProvider(
  provider: string,
  platformSettings: PlatformSettings | undefined,
): Record<string, unknown> | undefined {
  if (!platformSettings) return undefined;
  const p = provider.toLowerCase();
  if (p === "tiktok" && platformSettings.tiktok) {
    return { ...platformSettings.tiktok };
  }
  if (p === "instagram" && platformSettings.instagram) {
    return { ...platformSettings.instagram };
  }
  // YouTube accounts are stored with provider "google".
  if ((p === "google" || p === "youtube") && platformSettings.youtube) {
    return { ...platformSettings.youtube };
  }
  if (p === "pinterest" && platformSettings.pinterest) {
    return { ...platformSettings.pinterest };
  }
  return undefined;
}
