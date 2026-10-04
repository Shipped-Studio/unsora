import { AssetType } from "@prisma/client";
import prisma from "./db";
import { ImportError, safeGet } from "./remote-import";
import { uploadBufferToSupabase } from "./supabase-storage";

/**
 * Importing files from public URLs into the user's library (Supabase storage
 * plus an Asset row). Shared by the public `/uploads` endpoint and catalog
 * generations, which copy outside media in before pricing it.
 */

/** Server-side ingest cap for URL imports (bytes). */
export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

export function assetTypeFromMime(mime: string): AssetType {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

export function blobPath(userId: string, fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `uploads/${userId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

export async function createUploadAsset(
  userId: string,
  name: string,
  url: string,
  mimeType: string,
  fileSize: number | null,
) {
  return prisma.asset.create({
    data: {
      userId,
      name,
      url,
      mimeType,
      type: assetTypeFromMime(mimeType),
      source: "UPLOAD",
      fileSize: fileSize == null ? undefined : BigInt(fileSize),
    },
  });
}

/**
 * Download a public URL with the SSRF guard (public hosts only, redirects
 * re-checked, socket pinned) and the size cap. Throws ImportError with a
 * user-facing message.
 */
export async function fetchRemoteFile(
  url: string,
): Promise<{ buffer: Buffer; mime: string; name: string }> {
  if (!/^https?:\/\//i.test(url)) {
    throw new ImportError("url must be an http(s) URL");
  }
  const { res: remote } = await safeGet(url, {
    signal: AbortSignal.timeout(120_000),
  });
  const status = remote.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    remote.resume();
    throw new ImportError(`Could not fetch url (HTTP ${status})`);
  }
  const declared = Number(remote.headers["content-length"] ?? 0);
  if (declared > MAX_IMPORT_BYTES) {
    remote.destroy();
    throw new ImportError("File exceeds the 200MB import limit");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of remote) {
    total += (chunk as Buffer).length;
    if (total > MAX_IMPORT_BYTES) {
      remote.destroy();
      throw new ImportError("File exceeds the 200MB import limit");
    }
    chunks.push(chunk as Buffer);
  }
  return {
    buffer: Buffer.concat(chunks),
    mime:
      String(remote.headers["content-type"] ?? "").split(";")[0]?.trim() ||
      "application/octet-stream",
    name: sanitizeFileName(new URL(url).pathname) || "import",
  };
}

/** Import a public URL into the user's library and return its hosted URL. */
export async function importUrlToLibrary(
  userId: string,
  url: string,
): Promise<string> {
  const file = await fetchRemoteFile(url);
  const publicUrl = await uploadBufferToSupabase(
    file.buffer,
    blobPath(userId, file.name),
    file.mime,
  );
  await createUploadAsset(
    userId,
    file.name,
    publicUrl,
    file.mime,
    file.buffer.length,
  );
  return publicUrl;
}
