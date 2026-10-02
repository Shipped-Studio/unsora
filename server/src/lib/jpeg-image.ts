import sharp from "sharp";
import {
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "./supabase-storage";

/**
 * TikTok photo posts only accept JPEG/WebP (PNG fails with
 * file_format_check_failed) with dimensions up to 1080x1920 (larger images
 * fail with picture_size_check_failed). Generated images are commonly PNG
 * and larger than 1080p, so this normalizes any incompatible image once at
 * publish time and returns the URL of the converted copy.
 */

const TIKTOK_MAX_WIDTH = 1080;
const TIKTOK_MAX_HEIGHT = 1920;

/**
 * Return a TikTok-photo-compatible URL for the given image: JPEG/WebP and
 * within 1080x1920. Compatible images are returned unchanged; everything
 * else is re-encoded to JPEG (downscaled to fit if needed) and uploaded to
 * storage. On any failure the original URL is returned so the platform
 * stays the final arbiter.
 */
export async function ensureTikTokPhotoUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const source = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(source).metadata();

    const formatOk = meta.format === "jpeg" || meta.format === "webp";
    const sizeOk =
      (meta.width ?? 0) <= TIKTOK_MAX_WIDTH &&
      (meta.height ?? 0) <= TIKTOK_MAX_HEIGHT;

    if (formatOk && sizeOk) {
      return url;
    }

    if (!isSupabaseStorageConfigured()) {
      console.warn(
        "[jpeg-image] Storage not configured — cannot convert image for TikTok, using original URL",
      );
      return url;
    }

    // rotate() bakes in EXIF orientation; flatten() fills PNG transparency
    // with white instead of black.
    const jpeg = await sharp(source)
      .rotate()
      .resize(TIKTOK_MAX_WIDTH, TIKTOK_MAX_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    const fileName = `converted-jpeg/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.jpg`;

    return await uploadBufferToSupabase(jpeg, fileName, "image/jpeg");
  } catch (error) {
    console.warn(`[jpeg-image] TikTok photo conversion failed for ${url}:`, error);
    return url;
  }
}
