"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DownloadSimple,
  FilmSlate,
  Trash,
  Play,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { getCdnUrl } from "@/lib/video-utils";
import type { VideoExportItem } from "@/remotion/types";

export interface ExportListItem extends VideoExportItem {
  transcription?: {
    id: string;
    filename?: string | null;
    language?: string | null;
  } | null;
}

/**
 * Supabase storage forces a download (Content-Disposition: attachment)
 * when the URL has a `download` query param — no new tab needed.
 */
export function buildDownloadUrl(url: string, fileName: string): string {
  const cdnUrl = getCdnUrl(url);
  const sep = cdnUrl.includes("?") ? "&" : "?";
  return `${cdnUrl}${sep}download=${encodeURIComponent(`${fileName}.mp4`)}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(value: Date | string): string {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  queued: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  failed: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status?: string }) {
  const s = status || "queued";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
        STATUS_STYLES[s] ?? STATUS_STYLES.queued
      }`}
    >
      {s === "processing" && <Spinner className="size-2.5" />}
      {s}
    </span>
  );
}

interface ExportsListProps {
  exports: ExportListItem[];
  /** Request deletion — the parent shows a confirmation dialog. */
  onDelete: (id: string) => void;
  /** Show a link back to the project each export belongs to. */
  showProjectLink?: boolean;
}

export function ExportsList({
  exports,
  onDelete,
  showProjectLink = false,
}: ExportsListProps) {

  if (!exports.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <FilmSlate className="size-8 text-muted-foreground/40" weight="thin" />
        <p className="text-sm text-muted-foreground">No exports yet</p>
        <p className="max-w-xs text-xs text-muted-foreground/70">
          Export a video from any subtitle project and it will show up here so
          you can download it anytime.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {exports.map((exp) => {
        const fileName =
          typeof exp.settings?.fileName === "string" && exp.settings.fileName
            ? (exp.settings.fileName as string)
            : "Export";
        const outputUrl = exp.outputAsset?.url;
        const canDownload = exp.status === "completed" && !!outputUrl;

        return (
          <div
            key={exp.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{fileName}</span>
                <StatusBadge status={exp.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(exp.createdAt)} · {formatDuration(exp.duration)}
                {exp.width && exp.height ? ` · ${exp.width}×${exp.height}` : ""}
              </p>
              {showProjectLink && exp.transcription && (
                <Link
                  href={`/subtitle-editor/${exp.transcription.id}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  <ArrowSquareOut className="size-3" />
                  {exp.transcription.filename || "Open project"}
                </Link>
              )}
              {exp.status === "failed" && exp.error && (
                <p className="mt-1 truncate text-xs text-destructive">
                  {exp.error}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {canDownload && (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1.5 text-xs"
                    onClick={() => window.open(getCdnUrl(outputUrl!), "_blank")}
                  >
                    <Play className="size-3.5" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    className="gap-1.5 text-xs"
                    render={
                      <a href={buildDownloadUrl(outputUrl!, fileName)} />
                    }
                  >
                    <DownloadSimple className="size-3.5" weight="bold" />
                    Download
                  </Button>
                </>
              )}
              <button
                onClick={() => onDelete(exp.id)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
