import fs from "fs";
import path from "path";
import {
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "./supabase-storage";

/**
 * File uploads for generated media — backed by Supabase Storage.
 *
 * Requires SUPABASE_URL / SUPABASE_SECRET_KEY to be set; if storage is
 * not configured, uploads fail gracefully with `{ success: false }`.
 */

export const uploadVideoToStorage = async (
  url: string,
  originalName?: string,
) => {
  if (!isSupabaseStorageConfigured()) {
    console.error("[storage] SUPABASE_URL / SUPABASE_SECRET_KEY not configured — generated media will NOT be uploaded to Supabase and external provider URLs will be stored instead.");
    return { success: false as const, error: "Storage configuration missing" };
  }

  const response = await fetch(url);
  const blob = await response.blob();

  const fileExtension = originalName
    ? originalName.split(".").pop() || "mp4"
    : "mp4";
  const fileName = `${Date.now()}-video.${fileExtension}`;
  const contentType = blob.type || "video/mp4";

  const buffer = Buffer.from(await blob.arrayBuffer());
  const fileUrl = await uploadBufferToSupabase(buffer, fileName, contentType);
  return { success: true as const, fileUrl };
};

/**
 * Upload a local file to storage.
 * @param filePath - Local file path
 * @param originalName - Optional original filename
 */
export const uploadLocalFileToStorage = async (
  filePath: string,
  originalName?: string,
) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!isSupabaseStorageConfigured()) {
    console.error("[storage] SUPABASE_URL / SUPABASE_SECRET_KEY not configured — generated media will NOT be uploaded to Supabase and external provider URLs will be stored instead.");
    return { success: false as const, error: "Storage configuration missing" };
  }

  const fileExtension = originalName
    ? originalName.split(".").pop() || "mp4"
    : path.extname(filePath).slice(1) || "mp4";
  const fileName = `renders/${Date.now()}-video.${fileExtension}`;

  const fileBuffer = fs.readFileSync(filePath);
  const fileUrl = await uploadBufferToSupabase(
    fileBuffer,
    fileName,
    "video/mp4",
  );
  return { success: true as const, fileUrl };
};

/**
 * Upload any file from a URL to storage.
 * @param url - URL of the file to upload
 * @param originalName - Optional original filename
 * @param folder - Optional folder prefix (default: 'uploads')
 */
export const uploadUrlToStorage = async (
  url: string,
  originalName?: string,
  folder: string = "uploads",
) => {
  try {
    if (!isSupabaseStorageConfigured()) {
      console.error("[storage] SUPABASE_URL / SUPABASE_SECRET_KEY not configured — generated media will NOT be uploaded to Supabase and external provider URLs will be stored instead.");
      return {
        success: false as const,
        error: "Storage configuration missing",
      };
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const blob = await response.blob();

    const contentType =
      blob.type ||
      response.headers.get("content-type") ||
      "application/octet-stream";

    // Extract file extension from original name, URL, or infer from content type
    let fileExtension = "";
    if (originalName) {
      fileExtension = originalName.split(".").pop() || "";
    } else {
      const urlPath = new URL(url).pathname;
      const urlExt = urlPath.split(".").pop();
      if (urlExt && urlExt.length <= 5) {
        fileExtension = urlExt;
      } else {
        const typeMap: { [key: string]: string } = {
          "image/jpeg": "jpg",
          "image/jpg": "jpg",
          "image/png": "png",
          "image/gif": "gif",
          "image/webp": "webp",
          "image/svg+xml": "svg",
          "video/mp4": "mp4",
          "video/mpeg": "mpeg",
          "video/quicktime": "mov",
          "video/webm": "webm",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "application/pdf": "pdf",
        };
        fileExtension = typeMap[contentType] || "bin";
      }
    }

    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${fileExtension}`;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const fileUrl = await uploadBufferToSupabase(buffer, fileName, contentType);
    return {
      success: true as const,
      fileUrl,
      fileName,
      contentType,
    };
  } catch (error) {
    console.error("Error uploading file from URL:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
