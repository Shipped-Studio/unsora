"use client";

import { useRef, useState } from "react";
import {
  DotsThree,
  DownloadSimple,
  Pause,
  Play,
  FileX,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { friendlyGenerationError } from "@/components/generator/generation-error";
import {
  DeleteResultDialog,
  TILE_CLASS,
  TILE_GHOST_BUTTON_CLASS,
  TILE_SKELETON_BAR_CLASS,
  TILE_SKELETON_CLASS,
  TileDeleteButton,
} from "@/components/generator/result-tile";
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
  /** Word used in the delete confirmation. */
  noun?: string;
}

/** Result row for the voice generator and voice changer. */
export function VoiceGenerationCard({
  generation,
  onDelete,
  onDismiss,
  noun = "voiceover",
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
  // Finished, but the audio file is missing.
  const unavailable = !inProgress && !failed && !audioUrl;
  const title = generation.text || "Untitled";

  const status = inProgress
    ? generation.status === "QUEUED"
      ? "Queued"
      : generation.status === "submitting"
        ? "Starting"
        : "Generating"
    : failed
      ? friendlyGenerationError(generation.error)
      : unavailable
        ? "File unavailable. The file for this result is missing."
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
        "flex items-start gap-3 p-3",
        TILE_CLASS,
        playing && "ring-2 ring-ring/50",
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
            variant="outline"
            size="icon"
            onClick={togglePlay}
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          >
            {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
          </Button>
        </>
      ) : (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            failed ? "bg-destructive-subtle" : "bg-card",
          )}
        >
          {failed ? (
            <WarningCircle className="size-4 text-destructive" />
          ) : unavailable ? (
            <FileX className="size-4 text-muted-foreground" />
          ) : (
            <Spinner className="text-muted-foreground" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={failed ? (generation.error ?? undefined) : undefined}
        >
          {failed ? <span className="sr-only">Generation failed. </span> : null}
          {status}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {audioUrl ? (
          <a
            href={getCdnUrl(audioUrl, { download: true })}
            download
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              TILE_GHOST_BUTTON_CLASS,
            )}
            aria-label={`Download ${title}`}
          >
            <DownloadSimple />
          </a>
        ) : null}

        {onDismiss && (inProgress || failed) ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={TILE_GHOST_BUTTON_CLASS}
            onClick={() => onDismiss(generation.id)}
            aria-label={`Dismiss ${title}`}
          >
            <X />
          </Button>
        ) : onDelete && (failed || unavailable) ? (
          <TileDeleteButton onClick={() => setConfirmOpen(true)} />
        ) : onDelete && audioUrl ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={TILE_GHOST_BUTTON_CLASS}
                  aria-label={`More actions for ${title}`}
                />
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
        <DeleteResultDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          noun={noun}
          description="The audio will be removed from your results."
          onConfirm={() => onDelete(generation.id)}
        />
      ) : null}
    </article>
  );
}

export function VoiceRowSkeleton() {
  return (
    <div className={cn("flex items-center gap-3 p-3", TILE_SKELETON_CLASS)}>
      <Skeleton className={cn("size-9 rounded-md", TILE_SKELETON_BAR_CLASS)} />
      <div className="flex-1 space-y-2">
        <Skeleton className={cn("h-4 w-2/3", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-3 w-1/3", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
