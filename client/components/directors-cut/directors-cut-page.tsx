"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ImageSquare,
  VideoCamera,
  MusicNote,
  Sparkle,
  Camera,
  X,
  Play,
  SkipBack,
  SkipForward,
  Pause,
  Crop,
  FrameCorners,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { placeHolders } from "@/fake";

type ReferenceMode = "omni" | "first-last";

type UploadType = "image" | "video" | "audio";

const OMNI_LIMITS: Record<UploadType, number> = {
  image: 9,
  video: 3,
  audio: 3,
};

const uploadSlots = [
  {
    id: "image" as const,
    label: "Image",
    icon: ImageSquare,
    accept: "image/*",
  },
  {
    id: "video" as const,
    label: "Video",
    icon: VideoCamera,
    accept: "video/*",
  },
  { id: "audio" as const, label: "Audio", icon: MusicNote, accept: "audio/*" },
];

const generationThumbnails = placeHolders.slice(0, 8);

export function DirectorsCutPage() {
  const [mode, setMode] = useState<ReferenceMode>("omni");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setIsLoading(false), 250);
    return () => window.clearTimeout(t);
  }, []);

  const [omniFiles, setOmniFiles] = useState<Record<UploadType, File[]>>({
    image: [],
    video: [],
    audio: [],
  });

  const [firstFrame, setFirstFrame] = useState<File | null>(null);
  const [lastFrame, setLastFrame] = useState<File | null>(null);

  const omniInputRefs = useRef<Record<UploadType, HTMLInputElement | null>>({
    image: null,
    video: null,
    audio: null,
  });
  const firstFrameRef = useRef<HTMLInputElement | null>(null);
  const lastFrameRef = useRef<HTMLInputElement | null>(null);

  const handleOmniFiles = useCallback(
    (type: UploadType, incoming: FileList | null) => {
      if (!incoming) return;
      setOmniFiles((prev) => {
        const merged = [...prev[type], ...Array.from(incoming)];
        return { ...prev, [type]: merged.slice(0, OMNI_LIMITS[type]) };
      });
    },
    [],
  );

  const removeOmniFile = useCallback((type: UploadType, index: number) => {
    setOmniFiles((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  }, []);

  const firstFrameUrl = useMemo(
    () => (firstFrame ? URL.createObjectURL(firstFrame) : null),
    [firstFrame],
  );
  const lastFrameUrl = useMemo(
    () => (lastFrame ? URL.createObjectURL(lastFrame) : null),
    [lastFrame],
  );

  if (isLoading) {
    return <DirectorsCutSkeleton />;
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)] lg:overflow-hidden">
      {/* Left Panel */}
      <ScrollArea className="w-full border-b bg-card lg:w-[400px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 p-5 pb-8">
          {/* Section: Upload References */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Mode</h3>
              <div className="flex rounded-lg border bg-muted/50 p-0.5">
                <button
                  onClick={() => setMode("omni")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    mode === "omni"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Omni Reference
                </button>
                <button
                  onClick={() => setMode("first-last")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    mode === "first-last"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  First Frame Last Frame
                </button>
              </div>
            </div>

            {mode === "omni" ? (
              <OmniReferenceUpload
                files={omniFiles}
                inputRefs={omniInputRefs}
                onFiles={handleOmniFiles}
                onRemove={removeOmniFile}
              />
            ) : (
              <FirstLastFrameUpload
                firstFrame={firstFrame}
                lastFrame={lastFrame}
                firstFrameUrl={firstFrameUrl}
                lastFrameUrl={lastFrameUrl}
                firstFrameRef={firstFrameRef}
                lastFrameRef={lastFrameRef}
                onFirstFrame={setFirstFrame}
                onLastFrame={setLastFrame}
              />
            )}
          </div>

          {/* Section: Controls */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Controls</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Select defaultValue="seedance">
                <SelectTrigger variant="muted" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seedance">
                    <Camera className="mr-1 inline size-3.5" weight="fill" />
                    Seedance 2.0
                  </SelectItem>
                  <SelectItem value="kling">
                    <Camera className="mr-1 inline size-3.5" weight="fill" />
                    Kling 1.6
                  </SelectItem>
                  <SelectItem value="runway">
                    <Camera className="mr-1 inline size-3.5" weight="fill" />
                    Runway Gen-3
                  </SelectItem>
                  <SelectItem value="minimax">
                    <Camera className="mr-1 inline size-3.5" weight="fill" />
                    MiniMax
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="5s">
                <SelectTrigger variant="muted" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5s">5s</SelectItem>
                  <SelectItem value="10s">10s</SelectItem>
                  <SelectItem value="15s">15s</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="16:9">
                <SelectTrigger variant="muted" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="9:16">9:16</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="720p">
                <SelectTrigger variant="muted" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Prompt</h3>
              <button className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
                <Sparkle className="size-3.5" weight="fill" />
                AI Optimize
              </button>
            </div>
            <textarea
              placeholder="Describe the video you want to generate..."
              rows={6}
              className="w-full resize-none rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Generate Button */}
          <GenerateButton className="h-11 w-full rounded-xl text-sm font-semibold" />
        </div>
      </ScrollArea>

      {/* Right Panel */}
      <div className="flex flex-1 flex-col lg:overflow-hidden">
        {/* Video Preview */}
        <div className="flex-1 p-3 pb-0 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-medium">
                Close up portrait of a woman with dramatic lighting
              </h2>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Seedance 2.0
                </span>
                <span className="text-[11px] text-muted-foreground">5s</span>
                <span className="text-[11px] text-muted-foreground">16:9</span>
                <span className="text-[11px] text-muted-foreground">720p</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <FrameCorners className="size-3.5" />
                Extract Frame
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Crop className="size-3.5" />
                Crop
              </Button>
            </div>
          </div>

          <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl bg-muted">
            <Image
              src={placeHolders[0]}
              alt="Video preview"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex size-14 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform hover:scale-105"
              >
                {isPlaying ? (
                  <Pause className="size-6" weight="fill" />
                ) : (
                  <Play className="size-6" weight="fill" />
                )}
              </button>
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/40 px-4 py-1.5 backdrop-blur-sm">
              <button className="text-white/80 hover:text-white">
                <SkipBack className="size-4" weight="fill" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-white/80 hover:text-white"
              >
                {isPlaying ? (
                  <Pause className="size-4" weight="fill" />
                ) : (
                  <Play className="size-4" weight="fill" />
                )}
              </button>
              <button className="text-white/80 hover:text-white">
                <SkipForward className="size-4" weight="fill" />
              </button>
            </div>
          </div>
        </div>

        {/* Generations */}
        <div className="shrink-0 p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Generations
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Discover the best shots
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="size-3" />
              Add More
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {generationThumbnails.map((src, i) => (
              <div
                key={i}
                className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg bg-muted transition-all hover:ring-2 hover:ring-primary/40"
              >
                <Image
                  src={src}
                  alt={`Generation ${i + 1}`}
                  fill
                  className="object-cover"
                />
                {i % 3 === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                      <Play className="size-3.5" weight="fill" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Omni Reference Upload ───────────────────────────────────── */

function OmniReferenceUpload({
  files,
  inputRefs,
  onFiles,
  onRemove,
}: {
  files: Record<UploadType, File[]>;
  inputRefs: React.RefObject<Record<UploadType, HTMLInputElement | null>>;
  onFiles: (type: UploadType, incoming: FileList | null) => void;
  onRemove: (type: UploadType, index: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Upload slots */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {uploadSlots.map((slot) => {
          const count = files[slot.id].length;
          const limit = OMNI_LIMITS[slot.id];
          return (
            <button
              key={slot.id}
              onClick={() => inputRefs.current?.[slot.id]?.click()}
              disabled={count >= limit}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-xs font-medium transition-colors",
                count > 0
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                count >= limit && "cursor-not-allowed opacity-50",
              )}
            >
              <slot.icon
                className="size-5"
                weight={count > 0 ? "fill" : "regular"}
              />
              {slot.label}
              <span className="text-[10px] text-muted-foreground">
                {count}/{limit}
              </span>
              <input
                ref={(el) => {
                  if (inputRefs.current) inputRefs.current[slot.id] = el;
                }}
                type="file"
                accept={slot.accept}
                multiple
                className="hidden"
                onChange={(e) => {
                  onFiles(slot.id, e.target.files);
                  e.target.value = "";
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Uploaded file previews */}
      {(files.image.length > 0 ||
        files.video.length > 0 ||
        files.audio.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {files.image.map((file, i) => (
            <div
              key={`img-${i}`}
              className="group relative size-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-border"
            >
              <Image
                src={URL.createObjectURL(file)}
                alt=""
                className="size-full object-cover"
                width={100}
                height={100}
              />
              <button
                onClick={() => onRemove("image", i)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3.5 text-white" weight="bold" />
              </button>
            </div>
          ))}

          {files.video.map((file, i) => (
            <div
              key={`vid-${i}`}
              className="group relative flex h-16 items-center gap-2 rounded-lg bg-muted px-3 ring-1 ring-border"
            >
              <VideoCamera className="size-4 shrink-0 text-muted-foreground" />
              <div className="max-w-20">
                <span className="block truncate text-[11px] font-medium">
                  {file.name}
                </span>
                <span className="text-[10px] text-muted-foreground">Video</span>
              </div>
              <button
                onClick={() => onRemove("video", i)}
                className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
              >
                <X className="size-3 text-muted-foreground" weight="bold" />
              </button>
            </div>
          ))}

          {files.audio.map((file, i) => (
            <div
              key={`aud-${i}`}
              className="group relative flex h-16 items-center gap-2 rounded-lg bg-muted px-3 ring-1 ring-border"
            >
              <MusicNote className="size-4 shrink-0 text-muted-foreground" />
              <div className="max-w-20">
                <span className="block truncate text-[11px] font-medium">
                  {file.name}
                </span>
                <span className="text-[10px] text-muted-foreground">Audio</span>
              </div>
              <button
                onClick={() => onRemove("audio", i)}
                className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
              >
                <X className="size-3 text-muted-foreground" weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── First Frame / Last Frame Upload ──────────────────────────── */

function FirstLastFrameUpload({
  firstFrame,
  lastFrame,
  firstFrameUrl,
  lastFrameUrl,
  firstFrameRef,
  lastFrameRef,
  onFirstFrame,
  onLastFrame,
}: {
  firstFrame: File | null;
  lastFrame: File | null;
  firstFrameUrl: string | null;
  lastFrameUrl: string | null;
  firstFrameRef: React.RefObject<HTMLInputElement | null>;
  lastFrameRef: React.RefObject<HTMLInputElement | null>;
  onFirstFrame: (file: File | null) => void;
  onLastFrame: (file: File | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* First Frame */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          First Frame
        </span>
        {firstFrame && firstFrameUrl ? (
          <div className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-border">
            <Image
              src={firstFrameUrl}
              alt="First frame"
              fill
              className="object-cover"
            />
            <button
              onClick={() => onFirstFrame(null)}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="size-3 text-white" weight="bold" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => firstFrameRef.current?.click()}
            className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <UploadSimple className="size-6" />
            <span className="text-[11px] font-medium">Upload</span>
          </button>
        )}
        <input
          ref={firstFrameRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onFirstFrame(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Last Frame */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Last Frame
        </span>
        {lastFrame && lastFrameUrl ? (
          <div className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-border">
            <Image
              src={lastFrameUrl}
              alt="Last frame"
              fill
              className="object-cover"
            />
            <button
              onClick={() => onLastFrame(null)}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="size-3 text-white" weight="bold" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => lastFrameRef.current?.click()}
            className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <UploadSimple className="size-6" />
            <span className="text-[11px] font-medium">Upload</span>
          </button>
        )}
        <input
          ref={lastFrameRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onLastFrame(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/* ─── Loading skeleton ─────────────────────────────────────────── */

function DirectorsCutSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)] lg:overflow-hidden">
      <div className="w-full border-b bg-card lg:w-[400px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 p-5 pb-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-7 w-44 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>

          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:overflow-hidden">
        <div className="flex-1 p-3 pb-0 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-64" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-24 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </div>
          <Skeleton className="mt-3 aspect-video w-full rounded-xl" />
        </div>

        <div className="shrink-0 p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
