import type { LibraryFilterMediaType } from "@/hooks/use-library";

/**
 * Cloud import sources. Each one shows up only when its public env vars are
 * set (see .env.example). Next inlines these at build time.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
export const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";
export const DROPBOX_APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY ?? "";
export const ONEDRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_ONEDRIVE_CLIENT_ID ?? "";

export const CLOUD_SOURCES = {
  google_drive: Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY && GOOGLE_APP_ID),
  dropbox: Boolean(DROPBOX_APP_KEY),
  onedrive: Boolean(ONEDRIVE_CLIENT_ID),
} as const;

export type CloudSource = keyof typeof CLOUD_SOURCES;

export const CLOUD_SOURCE_LABELS: Record<CloudSource, string> = {
  google_drive: "Google Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
};

export interface PickOptions {
  /** Only offer this media type. */
  mediaType?: LibraryFilterMediaType;
  multiple: boolean;
  /** Most files to pick when `multiple` is set. */
  max?: number;
}

/** A user closed the picker. Not an error worth showing. */
export class PickerCancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

const MIME_TYPES: Record<LibraryFilterMediaType, string[]> = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/avif",
  ],
  video: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    "video/x-msvideo",
    "video/3gpp",
    "video/mpeg",
  ],
  audio: [
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/flac",
    "audio/webm",
  ],
};

const EXTENSIONS: Record<LibraryFilterMediaType, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".avif"],
  video: [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp", ".mpg", ".mpeg"],
  audio: [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac"],
};

const ALL_TYPES: LibraryFilterMediaType[] = ["image", "video", "audio"];

export function mimeTypesFor(mediaType?: LibraryFilterMediaType) {
  return (mediaType ? [mediaType] : ALL_TYPES).flatMap((t) => MIME_TYPES[t]);
}

export function extensionsFor(mediaType?: LibraryFilterMediaType) {
  return (mediaType ? [mediaType] : ALL_TYPES).flatMap((t) => EXTENSIONS[t]);
}
