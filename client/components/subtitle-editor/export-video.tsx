"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Export,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  Coins,
  Warning,
} from "@phosphor-icons/react";
import { getCdnUrl } from "@/lib/video-utils";
import {
  calculateRenderCredits,
  RENDER_CREDITS_PER_MINUTE,
} from "@/lib/render-pricing";
import { useUserUsage } from "@/hooks/use-user-usage";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

interface ExportPopoverProps {
  defaultFileName: string;
  durationSeconds: number;
  onExport: (fileName: string) => void;
  disabled?: boolean;
}

export function ExportPopover({
  defaultFileName,
  durationSeconds,
  onExport,
  disabled,
}: ExportPopoverProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState(defaultFileName);
  const { usage } = useUserUsage();

  const cost = calculateRenderCredits(durationSeconds);
  const balance = usage?.credits ?? null;
  const insufficient = balance !== null && cost > 0 && balance < cost;
  const noDuration = cost === 0;

  const handleOpen = (next: boolean) => {
    if (next) setFileName(defaultFileName);
    setOpen(next);
  };

  const handleExport = () => {
    if (insufficient || noDuration) return;
    setOpen(false);
    onExport(fileName.trim() || defaultFileName);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        render={
          <Button disabled={disabled}>
            <Export className="size-3.5" />
            Export Video
          </Button>
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Export your video</h3>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">File name</label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Enter file name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExport();
              }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-4" />
              <span>{formatDuration(durationSeconds)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {cost > 0 ? `${cost} credits` : "—"}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Rendering costs {RENDER_CREDITS_PER_MINUTE} credits per started
            minute of video.
            {balance !== null && (
              <>
                {" "}
                You have{" "}
                <span className="font-medium text-foreground">
                  {balance.toLocaleString()}
                </span>{" "}
                credits.
              </>
            )}
          </p>

          {insufficient && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <Warning className="mt-0.5 size-4 shrink-0" />
              <span>
                Not enough credits. You need {cost - (balance ?? 0)} more to
                export this video.
              </span>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleExport}
            disabled={insufficient || noDuration}
          >
            {insufficient ? "Insufficient Credits" : "Export Video"}
            {!insufficient && <ArrowRight className="ml-1 size-4" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ExportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: number;
  status: "idle" | "queued" | "processing" | "completed" | "failed";
  exportedVideoUrl: string | null;
}

export function ExportProgressDialog({
  open,
  onOpenChange,
  progress,
  status,
  exportedVideoUrl,
}: ExportProgressDialogProps) {
  const isActive = status === "queued" || status === "processing";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const displayProgress = Math.round(progress);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isActive && "Exporting Video"}
            {isCompleted && "Export Complete"}
            {isFailed && "Export Failed"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          {isActive && (
            <>
              <div className="relative flex size-28 items-center justify-center">
                <svg className="size-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/50"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={
                      2 * Math.PI * 52 * (1 - displayProgress / 100)
                    }
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <span className="absolute text-xl font-bold text-primary">
                  {displayProgress}%
                </span>
              </div>

              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">
                  Processing your video export...
                </p>
                <p className="text-xs text-muted-foreground">
                  This usually takes 1-2 minutes
                </p>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                You can close this and check your exports later
              </p>
            </>
          )}

          {isCompleted && (
            <>
              <div className="flex size-20 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="size-10 text-success" weight="fill" />
              </div>

              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Your video is ready!</p>
                <p className="text-xs text-muted-foreground">
                  Download or preview your exported video
                </p>
              </div>

              {exportedVideoUrl && (
                <div className="flex w-full gap-2">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      window.open(getCdnUrl(exportedVideoUrl), "_blank")
                    }
                  >
                    Download Video
                  </Button>
                </div>
              )}
            </>
          )}

          {isFailed && (
            <>
              <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="size-10 text-destructive" weight="fill" />
              </div>

              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Export failed</p>
                <p className="text-xs text-muted-foreground">
                  Something went wrong. Please try again.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
