import { Request, Response } from "express";
import { AssetType } from "@prisma/client";
import prisma from "../../../lib/db";
import {
  isSupabaseStorageConfigured,
  createSupabaseSignedUploadUrl,
  getSupabasePublicUrl,
  uploadBufferToSupabase,
  removeSupabaseObjects,
  SUPABASE_STORAGE_BUCKET,
} from "../../../lib/supabase-storage";
import { resolveUser } from "../helpers/resolve-user";
import { handlePublicError, sendError } from "../helpers/public-response";

/** Server-side ingest cap for URL imports (bytes). */
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

function assetTypeFromMime(mime: string): AssetType {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

function blobPath(userId: string, fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `uploads/${userId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

/** Path of an object inside our bucket, or null if the URL is elsewhere. */
function bucketPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
}

function formatAsset(asset: {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  type: AssetType;
  fileSize: bigint | null;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    name: asset.name,
    url: asset.url,
    mimeType: asset.mimeType,
    type: asset.type,
    fileSize: asset.fileSize == null ? null : Number(asset.fileSize),
    createdAt: asset.createdAt,
  };
}

async function createUploadAsset(
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
 * Public API media uploads. Every stored file is recorded as an Asset row
 * (source: UPLOAD) so it shows up in the user's media library.
 */
export class PublicUploadController {
  /**
   * POST /uploads — ingest a file from a public URL or base64 payload.
   * The file bytes are stored in Supabase Storage and an Asset is created.
   */
  create = async (req: Request, res: Response) => {
    try {
      if (!isSupabaseStorageConfigured()) {
        return sendError(res, 500, "Storage is not configured");
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) return sendError(res, 404, "User not found");

      const {
        url,
        base64,
        fileName,
        contentType,
      } = req.body as {
        url?: string;
        base64?: string;
        fileName?: string;
        contentType?: string;
      };

      if (!url && !base64) {
        return sendError(res, 400, 'Provide either "url" or "base64"');
      }
      if (url && base64) {
        return sendError(res, 400, 'Provide "url" or "base64", not both');
      }

      let buffer: Buffer;
      let mime: string;
      let name: string;

      if (url) {
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
          return sendError(res, 400, "url must be an http(s) URL");
        }
        const response = await fetch(url, { redirect: "follow" });
        if (!response.ok) {
          return sendError(
            res,
            400,
            `Could not fetch url (HTTP ${response.status})`,
          );
        }
        const declared = Number(response.headers.get("content-length") ?? 0);
        if (declared > MAX_IMPORT_BYTES) {
          return sendError(res, 400, "File exceeds the 200MB import limit");
        }
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMPORT_BYTES) {
          return sendError(res, 400, "File exceeds the 200MB import limit");
        }
        buffer = Buffer.from(arrayBuffer);
        mime =
          (typeof contentType === "string" && contentType.trim()) ||
          response.headers.get("content-type")?.split(";")[0]?.trim() ||
          "application/octet-stream";
        name =
          (typeof fileName === "string" && fileName.trim()) ||
          sanitizeFileName(new URL(url).pathname) ||
          "import";
      } else {
        if (typeof base64 !== "string" || !base64.trim()) {
          return sendError(res, 400, "base64 must be a non-empty string");
        }
        if (typeof fileName !== "string" || !fileName.trim()) {
          return sendError(res, 400, "fileName is required with base64");
        }
        // Accept both raw base64 and data: URLs.
        const dataUrlMatch = base64.match(/^data:([^;]+);base64,([\s\S]+)$/);
        const payload = dataUrlMatch ? dataUrlMatch[2] : base64;
        try {
          buffer = Buffer.from(payload, "base64");
        } catch {
          return sendError(res, 400, "base64 payload could not be decoded");
        }
        if (buffer.length === 0) {
          return sendError(res, 400, "base64 payload could not be decoded");
        }
        mime =
          (typeof contentType === "string" && contentType.trim()) ||
          dataUrlMatch?.[1] ||
          "application/octet-stream";
        name = fileName.trim();
      }

      const path = blobPath(user.id, name);
      const publicUrl = await uploadBufferToSupabase(buffer, path, mime);
      const asset = await createUploadAsset(
        user.id,
        sanitizeFileName(name),
        publicUrl,
        mime,
        buffer.length,
      );

      return res.json({ success: true, data: formatAsset(asset) });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public upload error:",
        "Failed to upload file",
      );
    }
  };

  /**
   * POST /uploads/signed-url — mint a direct-upload URL for large files.
   * After PUTting the bytes, call POST /uploads/complete with the blobName
   * so the file is registered as an Asset.
   */
  createSignedUrl = async (req: Request, res: Response) => {
    try {
      if (!isSupabaseStorageConfigured()) {
        return sendError(res, 500, "Storage is not configured");
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) return sendError(res, 404, "User not found");

      const { fileName } = req.body as { fileName?: string };
      if (!fileName || typeof fileName !== "string" || !fileName.trim()) {
        return sendError(res, 400, "fileName is required");
      }

      const path = blobPath(user.id, fileName.trim());
      const { signedUrl, token, publicUrl } =
        await createSupabaseSignedUploadUrl(path);

      return res.json({
        success: true,
        data: {
          uploadUrl: signedUrl,
          token,
          publicUrl,
          blobName: path,
          note: "PUT the file bytes to uploadUrl, then POST /uploads/complete with blobName to register the asset.",
        },
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public signed-url error:",
        "Failed to create signed upload URL",
      );
    }
  };

  /** POST /uploads/complete — register a direct-uploaded file as an Asset. */
  complete = async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req.auth.userId);
      if (!user) return sendError(res, 404, "User not found");

      const { blobName, fileName } = req.body as {
        blobName?: string;
        fileName?: string;
      };
      if (!blobName || typeof blobName !== "string") {
        return sendError(res, 400, "blobName is required");
      }
      // Only allow registering objects in the caller's own upload prefix.
      if (!blobName.startsWith(`uploads/${user.id}/`)) {
        return sendError(res, 403, "blobName does not belong to this user");
      }

      const publicUrl = getSupabasePublicUrl(blobName);
      if (!publicUrl) {
        return sendError(res, 500, "Storage is not configured");
      }

      const head = await fetch(publicUrl, { method: "HEAD" });
      if (!head.ok) {
        return sendError(
          res,
          400,
          "Upload not found in storage — PUT the file to the signed URL first",
        );
      }

      const mime =
        head.headers.get("content-type")?.split(";")[0]?.trim() ||
        "application/octet-stream";
      const size = Number(head.headers.get("content-length") ?? 0) || null;
      const name = sanitizeFileName(
        (typeof fileName === "string" && fileName.trim()) ||
          blobName.split("/").pop() ||
          "upload",
      );

      const asset = await createUploadAsset(
        user.id,
        name,
        publicUrl,
        mime,
        size,
      );

      return res.json({ success: true, data: formatAsset(asset) });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public upload complete error:",
        "Failed to register upload",
      );
    }
  };

  /** GET /uploads — list the user's uploaded assets. */
  list = async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req.auth.userId);
      if (!user) return sendError(res, 404, "User not found");

      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 12, 1),
        100,
      );

      const [assets, total] = await Promise.all([
        prisma.asset.findMany({
          where: { userId: user.id, source: "UPLOAD" },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.asset.count({ where: { userId: user.id, source: "UPLOAD" } }),
      ]);

      return res.json({
        success: true,
        data: {
          uploads: assets.map(formatAsset),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public list uploads error:",
        "Failed to list uploads",
      );
    }
  };

  /** DELETE /uploads/:assetId — delete an uploaded asset (and its file). */
  remove = async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req.auth.userId);
      if (!user) return sendError(res, 404, "User not found");

      const { assetId } = req.params;
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, userId: user.id, source: "UPLOAD" },
      });
      if (!asset) return sendError(res, 404, "Upload not found");

      const path = bucketPathFromUrl(asset.url);
      if (path) {
        await removeSupabaseObjects([path]).catch((err) =>
          console.error("Failed to remove storage object:", err),
        );
      }
      await prisma.asset.delete({ where: { id: asset.id } });

      return res.json({ success: true, message: "Upload deleted" });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public delete upload error:",
        "Failed to delete upload",
      );
    }
  };
}
