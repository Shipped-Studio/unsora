import { createHash } from "node:crypto";
import sharp from "sharp";
import type { PostType } from "@prisma/client";
import type { PostMediaWithAsset } from "../services/post.service";
import { PLATFORM_MEDIA_RULES, type ImageRules } from "./platform-media";
import {
  getSupabasePublicUrl,
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "./supabase-storage";

/**
 * Rewrites a post's images to fit one platform before it's published:
 *  - formats the platform doesn't take become JPEG (Instagram is JPEG-only),
 *  - images outside the allowed ratio are padded into it over a blurred,
 *    darkened copy of themselves (nothing is cropped away),
 *  - carousels are made consistent: Instagram pads every image to the first
 *    one's ratio, Pinterest needs every image at the same pixel size,
 *  - oversized images are scaled and re-compressed under the platform caps.
 *
 * Images that already fit are left untouched. Converted copies are stored
 * under a content-addressed key, so a retry or a second account on the same
 * platform reuses them. Any failure keeps the original image: the platform
 * stays the final judge rather than the post failing here.
 */

/** TikTok photos go through lib/jpeg-image.ts (ensureTikTokPhotoUrl). */
const SKIP_PROVIDERS = new Set(["tiktok"]);

interface Loaded {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  /** Animated GIF/WebP: never re-encoded, it would lose the animation. */
  animated: boolean;
}

type SharpImage = ReturnType<typeof sharp>;

interface Target {
  width: number;
  height: number;
}

async function load(url: string): Promise<Loaded> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  // EXIF orientations 5–8 rotate by 90°, swapping width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    buffer,
    format: meta.format ?? "unknown",
    width: (swap ? meta.height : meta.width) ?? 0,
    height: (swap ? meta.width : meta.height) ?? 0,
    animated: (meta.pages ?? 1) > 1,
  };
}

function clampRatio(ratio: number, rules: ImageRules): number {
  if (!rules.aspect) return ratio;
  return Math.min(Math.max(ratio, rules.aspect.min), rules.aspect.max);
}

/** Grow one side so the image reaches `ratio` (padding, never cropping). */
function padTo(width: number, height: number, ratio: number): Target {
  const current = width / height;
  if (Math.abs(current - ratio) < 0.005) return { width, height };
  return current > ratio
    ? { width, height: Math.round(width / ratio) }
    : { width: Math.round(height * ratio), height };
}

/** Scale down (never up) to the platform's pixel caps. */
function fitCaps(t: Target, rules: ImageRules): Target {
  let scale = 1;
  if (rules.maxWidth) scale = Math.min(scale, rules.maxWidth / t.width);
  if (rules.maxHeight) scale = Math.min(scale, rules.maxHeight / t.height);
  if (rules.maxPixels) {
    scale = Math.min(scale, Math.sqrt(rules.maxPixels / (t.width * t.height)));
  }
  return scale < 1
    ? {
        width: Math.max(1, Math.floor(t.width * scale)),
        height: Math.max(1, Math.floor(t.height * scale)),
      }
    : t;
}

/** Where every image of this post should end up for this platform. */
function plan(images: Loaded[], rules: ImageRules): Target[] {
  const first = images[0];
  const sharedRatio =
    images.length > 1 && rules.carousel
      ? clampRatio(first.width / first.height, rules)
      : null;

  if (sharedRatio !== null && rules.carousel === "same-size") {
    const size = fitCaps(padTo(first.width, first.height, sharedRatio), rules);
    return images.map(() => size);
  }

  return images.map((img) => {
    const ratio = sharedRatio ?? clampRatio(img.width / img.height, rules);
    return fitCaps(padTo(img.width, img.height, ratio), rules);
  });
}

/** Whether an image can go out exactly as it is. */
function fits(img: Loaded, target: Target, rules: ImageRules): boolean {
  return (
    rules.formats.includes(img.format) &&
    img.width === target.width &&
    img.height === target.height &&
    (!rules.maxBytes || img.buffer.length <= rules.maxBytes)
  );
}

/** Draw the image onto a target-sized canvas: blurred fill behind, image on top. */
async function render(img: Loaded, target: Target): Promise<SharpImage> {
  const fg = await sharp(img.buffer)
    .rotate()
    .resize(target.width, target.height, { fit: "inside" })
    .toBuffer();
  const fgMeta = await sharp(fg).metadata();
  const needsFill =
    fgMeta.width !== target.width || fgMeta.height !== target.height;

  if (!needsFill) return sharp(fg);

  const fill = await sharp(img.buffer)
    .rotate()
    .resize(target.width, target.height, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.8 })
    .toBuffer();
  return sharp(fill).composite([{ input: fg, gravity: "centre" }]);
}

/** JPEG under the byte cap: lower quality first, then scale down. */
async function encode(
  image: SharpImage,
  target: Target,
  maxBytes?: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const base = await image.flatten({ background: "#ffffff" }).png().toBuffer();
  let { width, height } = target;

  for (let attempt = 0; attempt < 8; attempt++) {
    for (const quality of [90, 82, 74, 66]) {
      const buffer = await sharp(base)
        .resize(width, height)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (!maxBytes || buffer.length <= maxBytes) {
        return { buffer, width, height };
      }
    }
    width = Math.max(1, Math.floor(width * 0.85));
    height = Math.max(1, Math.floor(height * 0.85));
  }
  throw new Error("Couldn't compress the image under the platform's size limit");
}

/** Store a converted image once; later publishes reuse it by key. */
async function store(key: string, buffer: Buffer): Promise<string> {
  const path = `platform-media/${key}.jpg`;
  const publicUrl = getSupabasePublicUrl(path);
  if (publicUrl) {
    const head = await fetch(publicUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (head?.ok) return publicUrl;
  }
  try {
    return await uploadBufferToSupabase(buffer, path, "image/jpeg");
  } catch (err) {
    // Another publish stored the same key first.
    if (publicUrl && /exist/i.test(String(err))) return publicUrl;
    throw err;
  }
}

/**
 * The post's media with each image made to fit `provider`. Videos, covers and
 * images that already fit pass through unchanged.
 */
export async function prepareMediaForPlatform(
  provider: string,
  postType: PostType,
  media: PostMediaWithAsset[],
): Promise<PostMediaWithAsset[]> {
  const rules = PLATFORM_MEDIA_RULES[provider]?.image;
  if (
    !rules ||
    SKIP_PROVIDERS.has(provider) ||
    (postType !== "IMAGE" && postType !== "CAROUSEL") ||
    !isSupabaseStorageConfigured()
  ) {
    return media;
  }

  const images = media
    .filter((m) => m.type === "IMAGE")
    .sort((a, b) => a.order - b.order);
  if (!images.length) return media;

  let loaded: Loaded[];
  try {
    loaded = await Promise.all(images.map((m) => load(m.asset.url)));
  } catch (err) {
    console.warn(`[platform-media] ${provider}: couldn't read images, sending originals:`, err);
    return media;
  }

  const targets = plan(loaded, rules);
  const replaced = new Map<string, PostMediaWithAsset>();

  await Promise.all(
    images.map(async (m, i) => {
      const img = loaded[i];
      const target = targets[i];
      if (fits(img, target, rules)) return;
      if (img.animated && rules.formats.includes(img.format)) return;

      try {
        const key = createHash("sha256")
          .update(JSON.stringify({ url: m.asset.url, target, maxBytes: rules.maxBytes }))
          .digest("hex")
          .slice(0, 40);
        const out = await encode(await render(img, target), target, rules.maxBytes);
        const url = await store(key, out.buffer);
        replaced.set(m.id, {
          ...m,
          asset: {
            ...m.asset,
            url,
            mimeType: "image/jpeg",
            width: out.width,
            height: out.height,
            fileSize: BigInt(out.buffer.length),
          },
        });
      } catch (err) {
        console.warn(`[platform-media] ${provider}: kept original ${m.asset.url}:`, err);
      }
    }),
  );

  if (!replaced.size) return media;
  console.log(`[platform-media] ${provider}: adjusted ${replaced.size} of ${images.length} image(s)`);
  return media.map((m) => replaced.get(m.id) ?? m);
}
