"use client";

import { useRef, useState } from "react";
import {
  DotsThree,
  DownloadSimple,
  Pause,
  Play,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";

export interface VoiceCardData {
  id: string;
  status: string;
  /** The script, or a short label for conversions. */
  text: string;
  /** Detail line once the clip is ready, e.g. the voice. */
  meta: string;
  outputUrl?: string | null;
  error?: string | null;
  createdAt?: string;
}

interface VoiceGenerationCardProps {
  generation: VoiceCardData;
  /** Deletes a saved clip (asks first). */
  onDelete?: (id: string) => void;
  /** Hides a clip that's still starting or failed to start. */
  onDismiss?: (id: string) => void;
}

/** Result row for the voice generator and voice changer. */
export function VoiceGenerationCard({
  generation,
  onDelete,
  onDismiss,
}: VoiceGenerationCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const audioUrl =
    generation.status === "COMPLETED" ? generation.outputUrl : null;
  const inProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const failed = generation.status === "FAILED";
  const title = generation.text || "Untitled";

  const status = inProgress
    ? generation.status === "QUEUED"
      ? "Queued"
      : generation.status === "submitting"
        ? "Starting"
        : "Generating"
    : failed
      ? generation.error || "Generation failed."
      : generation.meta;

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    audio.play().catch(() => {
      setPlaying(false);
      toast.error("Couldn't play this clip. Try downloading it instead.");
    });
  }

  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-xl bg-muted p-3",
        playing && "border-foreground/20",
      )}
    >
      {audioUrl ? (
        <>
          <audio
            ref={audioRef}
            src={getCdnUrl(audioUrl)}
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
          </Button>
        </>
      ) : (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            failed ? "bg-destructive/10" : "bg-muted",
          )}
        >
          {failed ? (
            <WarningCircle className="size-4 text-destructive" />
          ) : (
            <Spinner className="text-muted-foreground" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium" title={title}>
          {title}
        </p>
        <p
          className={cn(
            "truncate text-xs",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
          title={failed ? (generation.error ?? undefined) : undefined}
        >
          {status}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {audioUrl ? (
          <a
            href={getCdnUrl(audioUrl, { download: true })}
            download
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Download audio"
          >
            <DownloadSimple />
          </a>
        ) : null}

        {onDismiss && (inProgress || failed) ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDismiss(generation.id)}
            aria-label="Dismiss"
          >
            <X />
          </Button>
        ) : onDelete && failed ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmOpen(true)}
            aria-label="Delete"
          >
            <Trash />
          </Button>
        ) : onDelete && audioUrl ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More actions" />
              }
            >
              <DotsThree weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {onDelete ? (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
              <AlertDialogDescription>
                The audio will be removed from your results. This can&apos;t be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setConfirmOpen(false);
                  onDelete(generation.id);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </article>
  );
}

export function VoiceRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
      <Skeleton className="size-9 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
