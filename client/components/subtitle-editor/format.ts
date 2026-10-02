import { getCdnUrl } from "@/lib/video-utils";
import type { VideoExportItem } from "@/remotion/types";

/** 75 -> "1:15" */
export function formatClock(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 75.2 -> "01:15.200", for subtitle line timings. */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function exportFileName(item: VideoExportItem): string {
  const name = item.settings?.fileName;
  return typeof name === "string" && name.trim() ? name : "Export";
}

/** A URL that makes storage answer with a download instead of a preview. */
export function downloadUrl(url: string, fileName: string): string {
  return getCdnUrl(url, { download: `${fileName}.mp4` });
}

/** Ends server messages like "Failed to export" with a full stop. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Toast copy for a failed action: "Couldn't delete the export. <reason>".
 * Uses the server's message when there is one.
 */
export function failureMessage(action: string, error: unknown): string {
  const reason =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "Try again.";
  return `Couldn't ${action}. ${asSentence(reason)}`;
}
