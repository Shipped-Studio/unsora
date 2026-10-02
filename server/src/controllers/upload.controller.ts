import { Request, Response } from "express";
import type { AssetType } from "@prisma/client";
import prisma from "../lib/db";
import {
  isSupabaseStorageConfigured,
  createSupabaseSignedUploadUrl,
  uploadFileToSupabase,
  SUPABASE_STORAGE_BUCKET,
} from "../lib/supabase-storage";
import {
  downloadImportItem,
  ImportError,
  importDeadline,
  probeMetadata,
  removeTempFile,
  storageKey,
  type ImportProvider,
  type ImportRequestItem,
} from "../lib/remote-import";
import {
  findUserFolder,
  uploadAssetToLibraryItem,
} from "./library.controller";

const MAX_IMPORT_ITEMS = 20;
const IMPORT_CONCURRENCY = 3;
const PROVIDERS = new Set<ImportProvider>([
  "url",
  "dropbox",
  "google_drive",
  "onedrive",
]);

function parseImportItem(raw: unknown): ImportRequestItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.provider !== "string" || !PROVIDERS.has(r.provider as ImportProvider)) {
    return null;
  }
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.length <= max ? v : undefined;
  return {
    provider: r.provider as ImportProvider,
    url: str(r.url, 4096),
    fileId: str(r.fileId, 300),
    driveId: str(r.driveId, 300),
    accessToken: str(r.accessToken, 8192),
    name: str(r.name, 255),
    mimeType: str(r.mimeType, 255),
  };
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping order. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Issues a short-lived direct-upload URL for the browser.
 *
 * Generation happens here on the server (authenticated). The file bytes go
 * browser → Supabase Storage directly; only the signed URL is produced here.
 */
export class UploadController {
  async createSignedUrl(req: Request, res: Response) {
    try {
      const { fileName } = req.body as {
        fileName?: string;
        contentType?: string;
      };

      if (!fileName || typeof fileName !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "fileName is required" });
      }

      if (!isSupabaseStorageConfigured()) {
        return res
          .status(500)
          .json({ success: false, error: "Storage is not configured" });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const blobName = `uploads/${timestamp}-${fileName}`;

      const { signedUrl, token, publicUrl } =
        await createSupabaseSignedUploadUrl(blobName);

      return res.json({
        success: true,
        uploadUrl: signedUrl,
        token,
        blobUrl: publicUrl,
        blobName,
        containerName: SUPABASE_STORAGE_BUCKET,
        uploadMethod: "supabase",
      });
    } catch (error) {
      console.error("Error generating signed upload URL:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to generate signed upload URL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * POST /api/uploads/import
   * Body: { items: [{ provider: "url"|"dropbox"|"google_drive"|"onedrive",
   *                   url?, fileId?, driveId?, accessToken?, name?, mimeType? }],
   *         folderId?: string }   (1 to 20 items)
   * → { items: LibraryItem[], errors: [{ index, name, error }] }
   *
   * Each file is streamed to a temp file (with SSRF checks and size caps, see
   * lib/remote-import.ts), stored in the uploads bucket and recorded as an
   * upload Asset. Access tokens are only used for the download, never stored.
   */
  async importFiles(req: Request, res: Response) {
    try {
      if (!isSupabaseStorageConfigured()) {
        return res
          .status(500)
          .json({ success: false, error: "Storage is not configured" });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const rawItems = (req.body as { items?: unknown })?.items;
      if (
        !Array.isArray(rawItems) ||
        rawItems.length === 0 ||
        rawItems.length > MAX_IMPORT_ITEMS
      ) {
        return res.status(400).json({
          success: false,
          error: `Send 1 to ${MAX_IMPORT_ITEMS} items to import.`,
        });
      }

      let folderId: string | null = null;
      const rawFolderId = (req.body as { folderId?: unknown })?.folderId;
      if (rawFolderId) {
        const folder = await findUserFolder(user.id, rawFolderId);
        if (!folder) {
          return res
            .status(404)
            .json({ success: false, error: "Folder not found" });
        }
        folderId = folder.id;
      }

      const outcomes = await mapWithLimit(
        rawItems,
        IMPORT_CONCURRENCY,
        async (raw, index) => {
          const item = parseImportItem(raw);
          const displayName =
            (item?.name || item?.url || item?.fileId || `Item ${index + 1}`).slice(0, 255);
          if (!item) {
            return {
              ok: false as const,
              error: { index, name: displayName, error: "Invalid import item." },
            };
          }

          let tempPath: string | null = null;
          try {
            const file = await downloadImportItem(item, importDeadline());
            tempPath = file.tempPath;
            const meta = await probeMetadata(file);
            const url = await uploadFileToSupabase(
              file.tempPath,
              storageKey(user.id, file.name),
              file.mimeType,
            );
            const asset = await prisma.asset.create({
              data: {
                userId: user.id,
                name: file.name,
                url,
                mimeType: file.mimeType,
                type: file.category.toUpperCase() as AssetType,
                source: "UPLOAD",
                fileSize: BigInt(file.size),
                width: meta.width ? Math.round(meta.width) : null,
                height: meta.height ? Math.round(meta.height) : null,
                duration: meta.duration ?? null,
                folderId,
              },
            });
            return { ok: true as const, item: uploadAssetToLibraryItem(asset) };
          } catch (error) {
            if (!(error instanceof ImportError)) {
              console.error(`Import (${item.provider}) failed:`, error);
            }
            const message =
              error instanceof ImportError
                ? error.message
                : error instanceof Error && error.message.startsWith("Supabase upload failed")
                  ? "Storage rejected the file. It may be larger than the storage limit."
                  : "Something went wrong while importing this file.";
            return {
              ok: false as const,
              error: { index, name: displayName, error: message },
            };
          } finally {
            if (tempPath) await removeTempFile(tempPath);
          }
        },
      );

      return res.json({
        success: true,
        data: {
          items: outcomes.flatMap((o) => (o.ok ? [o.item] : [])),
          errors: outcomes.flatMap((o) => (o.ok ? [] : [o.error])),
        },
      });
    } catch (error) {
      console.error("Import error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to import files" });
    }
  }
}
