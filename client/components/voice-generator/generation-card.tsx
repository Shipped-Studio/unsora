"use client";

import {
  DownloadSimple,
  Trash,
  Warning,
  Microphone,
  X,
  Play,
  Pause,
} from "@phosphor-icons/react";
import { getCdnUrl } from "@/lib/video-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

export interface VoiceCardData {
  id: string;
  status: string;
  text: string;
  voiceId?: string;
  emotion?: string;
  outputUrl?: string | null;
  error?: string | null;
  createdAt?: string;
  voiceName?: string;
}

interface VoiceGenerationCardProps {
  generation: VoiceCardData;
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Generating…",
};

const VOICE_LABELS: Record<string, string> = {
  Friendly_Person: "Friendly Person",
  Wise_Woman: "Wise Woman",
  Deep_Voice_Man: "Deep Voice Man",
  Calm_Woman: "Calm Woman",
};

export function VoiceGenerationCard({
  generation,
  onDelete,
  onDismiss,
}: VoiceGenerationCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const audioUrl = generation.outputUrl;
  const isInProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const isFailed = generation.status === "FAILED";
  const isCompleted = generation.status === "COMPLETED" && audioUrl;
  const preview =
    generation.text.length > 100
      ? `${generation.text.slice(0, 100)}…`
      : generation.text;
  const voiceLabel =
    generation.voiceName ??
    VOICE_LABELS[generation.voiceId ?? ""] ??
    generation.voiceId ??
    "Voice";

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card transition-shadow hover:shadow-md",
        playing && "border-primary/30 ring-1 ring-primary/20",
      )}
    >
      {isCompleted && audioUrl && (
        <audio
          ref={audioRef}
          src={getCdnUrl(audioUrl)}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
      )}

      <div className="flex items-start gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        {isCompleted ? (
          <button
            type="button"
            onClick={togglePlay}
            className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary/30 via-primary/10 to-background text-primary sm:size-11"
            aria-label={playing ? "Pause" : "Play"}
          >
            <Microphone
              className="absolute size-4 opacity-25 sm:size-5"
              weight="duotone"
            />
            <span className="relative flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              {playing ? (
                <Pause className="size-3.5" weight="fill" />
              ) : (
                <Play className="size-3.5 translate-x-px" weight="fill" />
              )}
            </span>
          </button>
        ) : isInProgress ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-card sm:size-11">
            <Spinner className="size-4" />
          </div>
        ) : isFailed ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 sm:size-11">
            <Warning className="size-4 text-destructive/70" />
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/40 sm:size-11">
            <Microphone className="size-4 text-muted-foreground/40" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-foreground">
                {preview || "Untitled"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                {isInProgress
                  ? (STATUS_LABELS[generation.status] ?? generation.status)
                  : isFailed
                    ? generation.error || "Generation failed"
                    : `${voiceLabel}${generation.emotion ? ` · ${generation.emotion}` : ""}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {isCompleted && audioUrl && (
                <a
                  href={getCdnUrl(audioUrl, { download: true })}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Download audio"
                >
                  <DownloadSimple className="size-3.5" />
                </a>
              )}
              {isCompleted && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <Trash className="size-3.5" />
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete voice?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this generated audio clip.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => onDelete(generation.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isFailed && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete failed voice"
                  >
                    <X className="size-3.5" weight="bold" />
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete voice?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this failed generation. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => onDelete(generation.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isInProgress && onDismiss && (
                <button
                  onClick={() => onDismiss(generation.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
