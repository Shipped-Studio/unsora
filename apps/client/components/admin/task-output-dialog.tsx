"use client";

import {
  ArrowSquareOut,
  DownloadSimple,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react";
import { kindLabel } from "@/components/admin/charts";
import { StatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { TaskMedia } from "@/hooks/admin/types";
import { useAdminTaskDetail } from "@/hooks/admin/use-admin-data";
import { formatDateTime } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

export interface TaskRef {
  kind: string;
  id: string;
}

/**
 * The real output of one task (any feature): output and input media, the
 * prompt, parameters and any error.
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

  const meta = data
    ? [
        formatDateTime(data.createdAt),
        data.model,
        data.credits ? `${data.credits} credits` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {task ? kindLabel(task.kind) : "Task"}
            {data ? <StatusBadge status={data.status} /> : null}
          </DialogTitle>
          <DialogDescription>
            {meta ?? (error ? "Details unavailable" : "Loading task details")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <WarningCircle />
            <AlertDescription>
              <span title={error.message}>
                Couldn&apos;t load this task. Close it and try again.
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        {data ? (
          <div className="flex flex-col gap-4">
            {data.error ? (
              <Alert variant="destructive">
                <WarningCircle />
                <AlertDescription className="flex flex-col gap-1">
                  <span>This task failed. The provider returned:</span>
                  <span className="font-mono text-xs wrap-break-word whitespace-pre-wrap text-muted-foreground">
                    {data.error}
                  </span>
                </AlertDescription>
              </Alert>
            ) : null}

            {data.outputs.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.outputs.map((m, i) => (
                  <MediaBlock key={i} media={m} primary />
                ))}
              </div>
            ) : !data.error ? (
              <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                No output
                {data.status !== "COMPLETED"
                  ? ` yet. Status: ${data.status.toLowerCase()}.`
                  : "."}
              </p>
            ) : null}

            {data.text ? (
              <Section label="Prompt">
                <p className="max-h-40 overflow-y-auto rounded-lg border bg-card p-3 text-sm wrap-break-word whitespace-pre-wrap">
                  {data.text}
                </p>
              </Section>
            ) : null}

            {data.meta.length > 0 ? (
              <Section label="Details">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {data.meta.map((kv) => (
                    <div key={kv.label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{kv.label}</dt>
                      <dd className="truncate text-sm">{kv.value}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            ) : null}

            {data.inputs.length > 0 ? (
              <Section label="Inputs">
                <div className="flex flex-wrap gap-2">
                  {data.inputs.map((m, i) => (
                    <MediaBlock key={i} media={m} />
                  ))}
                </div>
              </Section>
            ) : null}
          </div>
        ) : null}
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
  return (
    <div className={cn("flex flex-col gap-1", primary ? "w-full" : "w-28 shrink-0")}>
      <div className="overflow-hidden rounded-lg border bg-card">
        <MediaPlayer media={media} primary={primary} />
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs text-muted-foreground">{media.label}</span>
        {primary ? (
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in a new tab"
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
            >
              <ArrowSquareOut />
            </a>
            <a
              href={media.url}
              download
              aria-label="Download"
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
            >
              <DownloadSimple />
            </a>
          </div>
        ) : null}
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
        className={cn(box, "object-contain")}
      />
    );
  }
  if (media.type === "IMAGE") {
    return <img src={media.url} alt={media.label} className={cn(box, "object-contain")} />;
  }
  if (media.type === "AUDIO") {
    return primary ? (
      <div className="p-3">
        <audio src={media.url} controls className="w-full" />
      </div>
    ) : (
      <div className="flex size-28 items-center justify-center">
        <FileText className="size-8 text-muted-foreground" />
      </div>
    );
  }
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${media.label}`}
      className={cn("flex items-center justify-center", box)}
    >
      <FileText className="size-8 text-muted-foreground" />
    </a>
  );
}
