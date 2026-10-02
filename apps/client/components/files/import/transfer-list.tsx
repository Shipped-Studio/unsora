"use client";

import {
  Check,
  Cloud,
  DropboxLogo,
  GoogleDriveLogo,
  LinkSimple,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type {
  TransferEntry,
  TransferSource,
} from "@/hooks/use-library-transfers";
import { cn } from "@/lib/utils";

function SourceIcon({ source }: { source: TransferSource }) {
  const className = "size-4 shrink-0 text-muted-foreground";
  switch (source) {
    case "google_drive":
      return <GoogleDriveLogo className={className} />;
    case "dropbox":
      return <DropboxLogo className={className} />;
    case "onedrive":
      return <Cloud className={className} />;
    case "url":
      return <LinkSimple className={className} />;
    default:
      return <UploadSimple className={className} />;
  }
}

function Status({ entry }: { entry: TransferEntry }) {
  if (entry.status === "done") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-success">
        <Check className="size-3.5" weight="bold" />
        Added
      </span>
    );
  }
  if (entry.status === "queued") {
    return <span className="shrink-0 text-xs text-muted-foreground">Waiting</span>;
  }
  if (entry.status === "working") {
    if (entry.progress !== null) {
      return (
        <span className="flex w-28 shrink-0 items-center gap-2">
          <Progress value={entry.progress} className="flex-1" aria-label={`Uploading ${entry.name}`} />
          <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
            {entry.progress}%
          </span>
        </span>
      );
    }
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Importing
      </span>
    );
  }
  return null;
}

/** Per-file progress and failures for uploads and imports. */
export function TransferList({
  entries,
  onDismiss,
  onClearFinished,
  className,
}: {
  entries: TransferEntry[];
  onDismiss: (id: string) => void;
  onClearFinished: () => void;
  className?: string;
}) {
  if (entries.length === 0) return null;

  const active = entries.filter(
    (e) => e.status === "queued" || e.status === "working",
  ).length;
  const failed = entries.filter((e) => e.status === "error").length;

  return (
    <section
      aria-label="Uploads and imports"
      aria-live="polite"
      className={cn("overflow-hidden rounded-xl bg-muted", className)}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-medium">
          {active > 0
            ? `Adding ${active} ${active === 1 ? "file" : "files"}`
            : failed > 0
              ? `${failed} ${failed === 1 ? "file" : "files"} couldn't be added`
              : "All files added"}
        </p>
        {active === 0 ? (
          <Button variant="ghost" size="xs" onClick={onClearFinished}>
            Dismiss
          </Button>
        ) : null}
      </div>
      <ul className="max-h-56 divide-y overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
            <SourceIcon source={entry.source} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm" title={entry.name}>
                {entry.name}
              </p>
              {entry.status === "error" ? (
                <p className="flex items-start gap-1 text-xs text-destructive">
                  <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{entry.error ?? "Couldn't add this file."}</span>
                </p>
              ) : null}
            </div>
            {entry.status === "error" ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Dismiss ${entry.name}`}
                onClick={() => onDismiss(entry.id)}
              >
                <X />
              </Button>
            ) : (
              <Status entry={entry} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
