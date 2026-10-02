"use client";

import {
  ArrowSquareOut,
  DownloadSimple,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/admin/status-badge";
import { kindLabel } from "@/components/admin/charts";
import { useAdminTaskDetail } from "@/hooks/admin/use-admin-data";
import type { TaskMedia } from "@/hooks/admin/types";
import { formatDateTime } from "@/lib/admin-format";

export interface TaskRef {
  kind: string;
  id: string;
}

/**
 * Views the real output of a single task (any feature). Opens when `task` is
 * set; fetches the normalised detail and renders the output/input media,
 * prompt, params and any error.
 */
export function TaskOutputDialog({
  task,
  onClose,
}: {
  task: TaskRef | null;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useAdminTaskDetail(
    task?.kind ?? null,
    task?.id ?? null,
    !!task,
  );

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task ? kindLabel(task.kind) : "Task"}
            {data && <StatusBadge status={data.status} />}
          </DialogTitle>
          {data && (
            <p className="text-xs text-muted-foreground">
              {formatDateTime(data.createdAt)}
              {data.model ? ` · ${data.model}` : ""}
              {data.credits ? ` · ${data.credits} credits` : ""}
            </p>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to load task. {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4">
            {/* Error state */}
            {data.error && (
              <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <WarningCircle
                  weight="fill"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="whitespace-pre-wrap break-words">
                  {data.error}
                </span>
              </div>
            )}

            {/* Outputs */}
            {data.outputs.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.outputs.map((m, i) => (
                  <MediaBlock key={i} media={m} primary />
                ))}
              </div>
            ) : (
              !data.error && (
                <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  No output produced{" "}
                  {data.status !== "COMPLETED"
                    ? `(status: ${data.status.toLowerCase()})`
                    : ""}
                  .
                </div>
              )
            )}

            {/* Prompt / text */}
            {data.text && (
              <Section label="Prompt">
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                  {data.text}
                </p>
              </Section>
            )}

            {/* Meta */}
            {data.meta.length > 0 && (
              <Section label="Details">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  {data.meta.map((kv) => (
                    <div key={kv.label} className="flex flex-col">
                      <span className="text-[11px] text-muted-foreground">
                        {kv.label}
                      </span>
                      <span className="truncate text-sm text-foreground">
                        {kv.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Inputs */}
            {data.inputs.length > 0 && (
              <Section label="Inputs">
                <div className="flex flex-wrap gap-2">
                  {data.inputs.map((m, i) => (
                    <MediaBlock key={i} media={m} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function MediaBlock({
  media,
  primary = false,
}: {
  media: TaskMedia;
  primary?: boolean;
}) {
  const wrap = primary
    ? "w-full"
    : "w-28 shrink-0";
  return (
    <div className={`flex flex-col gap-1 ${wrap}`}>
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <MediaPlayer media={media} primary={primary} />
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-muted-foreground">
          {media.label}
        </span>
        {primary && (
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Open"
            >
              <ArrowSquareOut className="size-3.5" />
            </a>
            <a
              href={media.url}
              download
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Download"
            >
              <DownloadSimple className="size-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaPlayer({
  media,
  primary,
}: {
  media: TaskMedia;
  primary: boolean;
}) {
  const box = primary ? "max-h-[52vh] w-full" : "size-28";
  if (media.type === "VIDEO") {
    return (
      <video
        src={media.url}
        poster={media.thumbnailUrl}
        controls={primary}
        muted={!primary}
        playsInline
        className={`${box} bg-black object-contain`}
      />
    );
  }
  if (media.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={media.url}
        alt={media.label}
        className={`${box} object-contain`}
      />
    );
  }
  if (media.type === "AUDIO") {
    return (
      <div className={`flex ${primary ? "p-3" : "size-28 items-center justify-center"}`}>
        {primary ? (
          <audio src={media.url} controls className="w-full" />
        ) : (
          <FileText className="size-8 text-muted-foreground" />
        )}
      </div>
    );
  }
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex ${box} items-center justify-center`}
    >
      <FileText className="size-8 text-muted-foreground" />
    </a>
  );
}
