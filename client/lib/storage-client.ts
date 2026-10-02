/**
 * Storage client for the browser.
 *
 * Uploads go directly to Supabase Storage using a short-lived signed upload
 * URL minted by our backend (`POST /api/uploads/signed-url`). The file bytes
 * never pass through our own server.
 */

export interface StorageUploadResult {
  success: boolean;
  blobUrl?: string;
  blobName?: string;
  size?: number;
  contentType?: string;
  error?: string;
}

export interface SignedUploadResponse {
  success: boolean;
  /** Full signed URL the browser PUTs to. */
  uploadUrl?: string;
  /** Supabase upload token (embedded in uploadUrl). */
  token?: string;
  /** Eventual public URL of the object. */
  blobUrl?: string;
  blobName?: string;
  containerName?: string;
  /** `azure` uses raw PUT; `supabase` uses multipart form (default). */
  uploadMethod?: "supabase" | "azure";
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Sanitize file name by removing whitespace and special characters.
 */
function sanitizeFileName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  const name =
    lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";

  const sanitizedName = name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitizedName + ext;
}

/**
 * Read the current Clerk session token from the browser Clerk singleton.
 * Lets this non-hook helper authenticate against the backend without
 * threading `useAuthFetch` through every caller.
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (
    window as unknown as {
      Clerk?: { session?: { getToken: () => Promise<string | null> } };
    }
  ).Clerk;
  return (await clerk?.session?.getToken?.()) ?? null;
}

/**
 * Request a signed direct-upload URL from the backend server.
 * @param fileName - Name of the file to upload
 * @param contentType - MIME type of the file
 */
export async function getSignedUploadUrl(
  fileName: string,
  contentType?: string,
): Promise<SignedUploadResponse> {
  try {
    const sanitizedFileName = sanitizeFileName(fileName);

    const token = await getAuthToken();
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";

    const response = await fetch(`${base}/api/uploads/signed-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        fileName: sanitizedFileName,
        contentType,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(
        errorData.error ||
          `Failed to get signed upload URL: ${response.status}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Signed upload URL error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error getting signed upload URL",
    };
  }
}

/**
 * Upload a file directly to Supabase Storage using a signed upload URL,
 * with progress tracking.
 * @param file - File to upload
 * @param signed - Response from getSignedUploadUrl
 * @param onProgress - Progress callback
 */
export async function uploadToSignedUrl(
  file: File,
  signed: SignedUploadResponse,
  onProgress?: (progress: UploadProgress) => void,
): Promise<StorageUploadResult> {
  try {
    if (!signed.success || !signed.uploadUrl) {
      throw new Error(signed.error || "Invalid signed upload URL");
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            success: true,
            blobUrl: signed.blobUrl,
            blobName: signed.blobName,
            size: file.size,
            contentType: file.type,
          });
        } else {
          reject(
            new Error(
              `Upload failed with status ${xhr.status}: ${xhr.statusText}`,
            ),
          );
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });
      xhr.addEventListener("abort", () => {
        reject(new Error("Upload was aborted"));
      });

      xhr.open("PUT", signed.uploadUrl || "");

      if (signed.uploadMethod === "azure") {
        xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-ms-blob-cache-control", "max-age=3600");
        xhr.send(file);
        return;
      }

      // Supabase signed upload expects multipart form-data with the file under
      // an empty field name (mirrors supabase-js `uploadToSignedUrl`).
      xhr.setRequestHeader("x-upsert", "false");
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      xhr.send(form);
    });
  } catch (error) {
    console.error("Storage upload error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error during upload",
    };
  }
}

/**
 * Complete upload workflow: get a signed URL and upload the file.
 * @param file - File to upload
 * @param onProgress - Progress callback
 */
export async function uploadFileToStorage(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<StorageUploadResult> {
  try {
    const signed = await getSignedUploadUrl(file.name, file.type);

    if (!signed.success) {
      return {
        success: false,
        error: signed.error || "Failed to get signed upload URL",
      };
    }

    return await uploadToSignedUrl(file, signed, onProgress);
  } catch (error) {
    console.error("Complete upload workflow error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during upload workflow",
    };
  }
}

/**
 * Extract object name/path from a public storage URL.
 */
export function extractBlobNameFromUrl(blobUrl: string): string {
  try {
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split("/").filter((p) => p);
    return pathParts.slice(1).join("/");
  } catch (error) {
    console.error("Failed to extract object name from URL:", error);
    return "";
  }
}

/**
 * Generate a date-based path for organizing media (e.g. "2025/01/17").
 */
export function generateDatePath(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
