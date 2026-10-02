import { Request, Response } from "express";
import {
  isSupabaseStorageConfigured,
  createSupabaseSignedUploadUrl,
  SUPABASE_STORAGE_BUCKET,
} from "../lib/supabase-storage";

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
}
