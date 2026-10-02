"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  DownloadSimple,
  Export,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScheduleLink } from "@/components/generator/tool-layout";
import {
  asSentence,
  downloadUrl,
  formatClock,
} from "@/components/subtitle-editor/format";
import type { ExportJobStatus } from "@/hooks/subtitle/use-export-job";
import { useUserUsage } from "@/hooks/use-user-usage";
import {
  calculateRenderCredits,
  RENDER_CREDITS_PER_MINUTE,
} from "@/lib/render-pricing";

export function ExportPopover({
  defaultFileName,
  durationSeconds,
  onExport,
  disabled,
}: {
  defaultFileName: string;
  durationSeconds: number;
  onExport: (fileName: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState(defaultFileName);
  const fileNameId = useId();
  const { usage } = useUserUsage();

  const cost = calculateRenderCredits(durationSeconds);
  const balance = usage?.credits ?? null;
  const shortfall = balance !== null && cost > balance ? cost - balance : 0;
  const canExport = cost > 0 && shortfall === 0;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setFileName(defaultFileName);
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button size="sm" disabled={disabled} />}>
        <Export />
        Export
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Export video</PopoverTitle>
          <PopoverDescription>
            Renders the video with its subtitles, title and watermark.
          </PopoverDescription>
        </PopoverHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canExport) return;
            setOpen(false);
            onExport(fileName.trim() || defaultFileName);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={fileNameId}>File name</Label>
            <Input
              id={fileNameId}
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder={defaultFileName}
            />
          </div>

          <dl className="space-y-1.5 rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Length</dt>
              <dd className="tabular-nums">
                {durationSeconds > 0 ? formatClock(durationSeconds) : "Unknown"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cost</dt>
              <dd className="font-medium tabular-nums">
                {cost > 0 ? `${cost} credits` : "Unknown"}
              </dd>
            </div>
            {balance !== null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="tabular-nums">
                  {balance.toLocaleString()} credits
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="text-xs text-muted-foreground">
            {RENDER_CREDITS_PER_MINUTE} credits per started minute of video.
          </p>

          {shortfall > 0 ? (
            <p className="text-xs text-destructive">
              You need {shortfall} more credits.{" "}
              <Link href="/billing" className="underline underline-offset-4">
                Get credits
              </Link>
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={!canExport}>
            {shortfall > 0 ? "Not enough credits" : "Export"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function ExportProgressDialog({
  open,
  onOpenChange,
  onClosed,
  status,
  progress,
  error,
  creditsUsed,
  videoUrl,
  fileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the close animation, so the content doesn't flash. */
  onClosed: () => void;
  status: ExportJobStatus;
  progress: number;
  error: string | null;
  creditsUsed: number | null;
  videoUrl: string | null;
  fileName: string;
}) {
  const percent = Math.round(progress);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) onClosed();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {status === "completed" && videoUrl ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle weight="fill" className="size-5 text-success" />
                Export ready
              </DialogTitle>
              <DialogDescription>
                It&apos;s also saved in this project&apos;s Exports tab.
              </DialogDescription>
            </DialogHeader>
            <video
              src={videoUrl}
              controls
              playsInline
              className="max-h-[50svh] w-full rounded-lg bg-muted"
            />
            <DialogFooter>
              <ScheduleLink url={videoUrl} mediaType="video" size="default" />
              <a
                href={downloadUrl(videoUrl, fileName)}
                className={buttonVariants()}
              >
                <DownloadSimple />
                Download
              </a>
            </DialogFooter>
          </>
        ) : status === "failed" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <WarningCircle weight="fill" className="size-5 text-destructive" />
                Export failed
              </DialogTitle>
              <DialogDescription>
                {error
                  ? asSentence(error)
                  : "The render failed. Try exporting again."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {status === "queued" ? "Queueing export" : "Exporting video"}
              </DialogTitle>
              <DialogDescription>
                Usually takes a minute or two. You can close this; the export
                keeps running and shows up in the Exports tab.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{status === "queued" ? "Queued" : "Rendering"}</span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <Progress value={percent} aria-label="Export progress" />
              {creditsUsed ? (
                <p className="text-xs text-muted-foreground">
                  {creditsUsed} credits used.
                </p>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
