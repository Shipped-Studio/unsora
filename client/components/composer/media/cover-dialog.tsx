"use client";

import { useEffect, useRef, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/scheduler/dates";

/** Draws the current frame of a video element to a JPEG file. */
async function captureFrame(video: HTMLVideoElement): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas isn't available in this browser.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Couldn't read that frame.");
  return new File([blob], `cover-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export function CoverDialog({
  open,
  onOpenChange,
  videoUrl,
  duration,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  duration?: number;
  onSave: (input: { file: File; timestampMs?: number }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"frame" | "upload">("frame");

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const seek = (seconds: number) => {
    setTime(seconds);
    if (videoRef.current) videoRef.current.currentTime = seconds;
  };

  const useFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    setError(null);
    try {
      // Wait for the frame at the chosen time to be decoded.
      if (Math.abs(video.currentTime - time) > 0.05 || video.seeking) {
        await new Promise<void>((resolve) => {
          video.addEventListener("seeked", () => resolve(), { once: true });
          video.currentTime = time;
        });
      }
      const file = await captureFrame(video);
      onSave({ file, timestampMs: Math.round(time * 1000) });
      onOpenChange(false);
    } catch {
      setError(
        "This video's host doesn't allow grabbing frames. Upload a cover image instead.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cover</DialogTitle>
          <DialogDescription>
            Used as the thumbnail on Instagram, YouTube and Pinterest. TikTok uses
            the frame you pick.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "frame" | "upload")}>
          <TabsList>
            <TabsTrigger value="frame">Pick a frame</TabsTrigger>
            <TabsTrigger value="upload">Upload image</TabsTrigger>
          </TabsList>
          <TabsContent value="frame" className="space-y-4 pt-3">
            <div className="overflow-hidden rounded-xl bg-media">
              <video
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(event) => {
                  const d = event.currentTarget.duration;
                  if (Number.isFinite(d)) setLength(d);
                }}
                className="mx-auto max-h-80 w-full object-contain"
              />
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[time]}
                min={0}
                max={Math.max(length - 0.05, 0.1)}
                step={0.05}
                onValueChange={(value) =>
                  seek(Array.isArray(value) ? (value[0] as number) : (value as number))
                }
                aria-label="Frame position"
                className="flex-1"
              />
              <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                {formatDuration(time) || "0:00"}
              </span>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </TabsContent>
          <TabsContent value="upload" className="pt-3">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-muted py-10 text-center">
              <p className="text-sm text-muted-foreground">
                JPG or PNG, ideally the same shape as the video.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <UploadSimple />
                Choose image
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  onSave({ file });
                  onOpenChange(false);
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {tab === "frame" ? (
            <Button type="button" onClick={useFrame} disabled={busy}>
              {busy ? <Spinner /> : null}
              Use this frame
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
