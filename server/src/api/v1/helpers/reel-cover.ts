import { PostMediaInput } from "./post-validation";

export function coverUrlFromVideoMedia(
  media: Record<string, unknown>,
): string | undefined {
  if (typeof media.cover_url === "string" && media.cover_url.trim()) {
    return media.cover_url.trim();
  }
  if (typeof media.coverUrl === "string" && media.coverUrl.trim()) {
    return media.coverUrl.trim();
  }
  return undefined;
}

export function coverUrlFromSettings(settings: unknown): string | undefined {
  if (!settings || typeof settings !== "object") return undefined;
  const root = settings as Record<string, unknown>;
  const instagram =
    root.instagram && typeof root.instagram === "object"
      ? (root.instagram as Record<string, unknown>)
      : null;
  if (!instagram) return undefined;
  if (typeof instagram.cover_url === "string" && instagram.cover_url.trim()) {
    return instagram.cover_url.trim();
  }
  if (typeof instagram.coverUrl === "string" && instagram.coverUrl.trim()) {
    return instagram.coverUrl.trim();
  }
  return undefined;
}

/** Append THUMBNAIL row when a custom cover image URL is provided. */
export function appendCoverMedia(
  items: PostMediaInput[],
  coverUrl: string | undefined,
): PostMediaInput[] {
  if (!coverUrl) return items;
  if (items.some((m) => m.type === "THUMBNAIL")) return items;
  return [...items, { type: "THUMBNAIL", url: coverUrl, order: 0 }];
}
