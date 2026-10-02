import { VideoFile } from "@/types/video";

export type VideoAction =
  | "process-video"
  | "generate-subtitles"
  | "subtitle-removal";

const videoValidationRules = {
  "process-video": {
    maxDuration: 25,
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ["video/mp4", "video/mov", "video/avi"],
  },
  "generate-subtitles": {
    maxDuration: 300,
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ["video/mp4", "video/mov", "video/avi"],
  },
  "subtitle-removal": {
    maxDuration: 120,
    maxSize: 200 * 1024 * 1024, // 200MB
    allowedTypes: ["video/mp4", "video/mov", "video/avi"],
  },
};

export function createVideoFile(file: File): VideoFile {
  const id = crypto.randomUUID();
  return {
    id,
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
    size: file.size,
    type: file.type,
    uploadStatus: "pending",
    uploadProgress: 0,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function validateVideoFile(file: File): {
  valid: boolean;
  error?: string;
  warning?: string;
} {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const warningSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = [
    "video/mp4",
    "video/mov",
    "video/avi",
    "video/quicktime",
    "video/x-msvideo",
  ];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Video exceeds 100MB limit. Current size: ${formatFileSize(
        file.size,
      )}`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Supported types: MP4, MOV, AVI`,
    };
  }

  if (file.size > warningSize) {
    return {
      valid: true,
      warning: `Large file detected (${formatFileSize(
        file.size,
      )}). Processing may take longer.`,
    };
  }

  return { valid: true };
}

export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

export async function getVideoDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const dimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      window.URL.revokeObjectURL(video.src);
      resolve(dimensions);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video metadata for dimensions"));
    };

    video.src = URL.createObjectURL(file);
  });
}

export async function getVideoMetadata(file: File): Promise<{
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      window.URL.revokeObjectURL(video.src);
      resolve(metadata);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

export async function getVideoMetadataFromUrl(videoUrl: string): Promise<{
  duration: number;
  width: number;
  height: number;
} | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.crossOrigin = "anonymous"; // Handle CORS for external URLs

    // Set a timeout to avoid hanging
    const timeout = setTimeout(() => {
      resolve(null);
    }, 10000); // 10 second timeout

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      resolve(metadata);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      // If we can't load the video metadata, return null
      // This could happen due to CORS, network issues, etc.
      resolve(null);
    };

    video.src = videoUrl;
  });
}

export async function validateVideoFileWithDuration(
  file: File,
  action: VideoAction,
): Promise<{
  valid: boolean;
  error?: string;
  warning?: string;
  metadata?: { duration: number; width: number; height: number };
  action?: VideoAction;
}> {
  // First validate size and type
  const basicValidation = validateVideoFile(file);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  const maxDuration = videoValidationRules[action].maxDuration;
  const limitLabel =
    maxDuration >= 60
      ? `${Math.floor(maxDuration / 60)} minute${maxDuration >= 120 ? "s" : ""}`
      : `${maxDuration} second${maxDuration !== 1 ? "s" : ""}`;

  try {
    const metadata = await getVideoMetadata(file);

    if (metadata.duration > maxDuration) {
      return {
        valid: false,
        error: `Video exceeds ${limitLabel} limit. Current duration: ${Math.round(
          metadata.duration,
        )}s`,
      };
    }

    return {
      ...basicValidation,
      metadata,
    };
  } catch {
    return {
      valid: true,
      warning: `Could not verify video duration. Please ensure video is under ${limitLabel}.`,
    };
  }
}

export function uploadToTmpFiles(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          // Convert tmpfiles.org URL to direct download URL
          const directUrl = data.data.url.replace(
            "tmpfiles.org/",
            "tmpfiles.org/dl/",
          );
          resolve(directUrl);
        } else {
          reject(new Error("Upload failed"));
        }
      })
      .catch(reject);
  });
}

export function calculateSubtitleRemovalCredits(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 10) * 10;
}

export function cleanupVideoFiles(videos: VideoFile[]): void {
  videos.forEach((video) => {
    if (video.previewUrl) {
      URL.revokeObjectURL(video.previewUrl);
    }
  });
}

export async function downloadVideo(videoUrl: string, filename: string) {
  if (!videoUrl) return;

  try {
    const response = await fetch(videoUrl, {
      method: "GET",
    });

    if (!response.ok) {
      console.error("HTTP error:", response.status, response.statusText);
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading video:", error);
  }
}

/**
 * Returns a usable media URL.
 *
 * Pass `{ download: true }` (or a filename) to append Supabase Storage's
 * `?download` param, which makes Storage respond with
 * `Content-Disposition: attachment` so the browser saves the file instead of
 * previewing it. This works cross-origin, unlike the HTML `download` attribute.
 */
export function getCdnUrl(
  url: string,
  opts?: { download?: boolean | string },
): string {
  if (!url) return url;
  if (opts?.download === undefined || opts.download === false) return url;
  try {
    const u = new URL(url);
    u.searchParams.set(
      "download",
      typeof opts.download === "string" ? opts.download : "",
    );
    return u.toString();
  } catch {
    return url;
  }
}
