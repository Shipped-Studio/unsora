"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, DownloadSimple, Trash } from "@phosphor-icons/react";
import { ScheduleLink } from "@/components/generator/tool-layout";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getCdnUrl } from "@/lib/video-utils";
import {
  copyText,
  isPending,
  pendingLabel,
  type MediaResult,
} from "./media-result-card";
import {
  DeleteResultDialog,
  FailedState,
  UnavailableState,
} from "./result-tile";

const cdnLoader = ({ src }: { src: string }) => src;

export interface ResultDetail {
  label: string;
  value: React.ReactNode;
}

export function formatCreatedAt(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatCredits(credits?: number | null) {
  if (credits == null || credits <= 0) return null;
  return `${credits} ${credits === 1 ? "credit" : "credits"}`;
}

/** Drops rows whose value is empty so callers can pass optional fields. */
export function detailRows(
  rows: { label: string; value: React.ReactNode | null | undefined }[],
): ResultDetail[] {
  return rows.filter(
    (row): row is ResultDetail =>
      row.value !== null && row.value !== undefined && row.value !== "",
  );
}

interface MediaResultDialogProps {
  result: MediaResult | null;
  /** "video", "image", "thumbnail": used in labels. */
  noun: string;
  /** Dialog heading, usually the model or mode. */
  title: string;
  createdAt?: string | null;
  details?: ResultDetail[];
  /** Extra content under the details, e.g. a source link. */
  footnote?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

/**
 * Detail view for a generated file: media on the left (top on mobile),
 * prompt and settings on the right, then Delete, Download and Schedule.
 */
export function MediaResultDialog({
  result,
  noun,
  title,
  createdAt,
  details = [],
  footnote,
  open,
  onOpenChange,
  onDelete,
}: MediaResultDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!result) return null;

  const url =
    result.mediaType === "image"
      ? (result.url ?? result.thumbnailUrl ?? null)
      : (result.url ?? null);
  const complete = result.status === "COMPLETED" && !!url;
  const failed = result.status === "FAILED";
  const created = formatCreatedAt(createdAt);
  const canDelete = !!onDelete && !result.local;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-5xl md:grid-cols-[minmax(0,1fr)_20rem] md:overflow-hidden">
        <div className="flex min-h-48 items-center justify-center bg-muted md:max-h-[calc(100dvh-2rem)]">
          {complete && result.mediaType === "video" ? (
            <video
              key={url}
              src={getCdnUrl(url)}
              poster={result.thumbnailUrl ?? undefined}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[min(50dvh,32rem)] w-full object-contain md:max-h-[calc(100dvh-2rem)]"
            />
          ) : complete ? (
            <div className="relative h-[min(45dvh,28rem)] w-full md:h-[min(calc(100dvh-2rem),44rem)]">
              <Image
                loader={cdnLoader}
                src={getCdnUrl(url)}
                alt={result.prompt || title}
                fill
                sizes="(min-width: 768px) 60vw, 100vw"
                className="object-contain"
              />
            </div>
          ) : failed ? (
            <FailedState error={result.error} className="max-w-sm py-12" />
          ) : isPending(result.status) ? (
            <div
              role="status"
              className="flex items-center gap-2 py-12 text-sm text-muted-foreground"
            >
              <Spinner />
              {pendingLabel(result.status)}
            </div>
          ) : (
            <UnavailableState className="max-w-sm py-12" />
          )}
        </div>

        <div className="flex min-h-0 flex-col border-t md:max-h-[calc(100dvh-2rem)] md:border-t-0 md:border-l">
          <div className="flex-1 space-y-5 p-5 md:overflow-y-auto">
            <DialogHeader className="pr-8">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {created ? `Created ${created}` : `Generated ${noun}`}
              </DialogDescription>
            </DialogHeader>

            {result.prompt.trim() && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Prompt</h3>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void copyText(result.prompt)}
                  >
                    <Copy />
                    Copy
                  </Button>
                </div>
                <p className="max-h-28 overflow-y-auto text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground md:max-h-60">
                  {result.prompt}
                </p>
              </section>
            )}

            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {details.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="truncate text-sm tabular-nums">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {footnote}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-popover p-4 md:static">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash />
                Delete
              </Button>
            )}
            {complete && (
              <div className="ml-auto flex flex-wrap gap-2">
                <a
                  href={getCdnUrl(url, { download: true })}
                  download
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <DownloadSimple />
                  Download
                </a>
                <ScheduleLink
                  url={url}
                  mediaType={result.mediaType}
                  variant="default"
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {canDelete && (
        <DeleteResultDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          noun={noun}
          onConfirm={() => {
            onDelete?.(result.id);
            setConfirmDelete(false);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
