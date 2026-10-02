"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileVideo,
  ImageSquare,
  SpeakerHigh,
  FolderOpen,
  X,
  CheckCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { uploadFileToStorage, type UploadProgress } from "@/lib/storage-client";
import { getCdnUrl } from "@/lib/video-utils";
import { useAssets } from "@/contexts/assets-context";
import { toast } from "sonner";

const MOTION_CONTROLS_MODELS = [
  {
    value: "kling_mc_2.6_pro",
    label: "Kling 2.6 Pro Motion Control",
    desc: "Fast and efficient motion control",
    resolution: "1080p" as const,
    creditRange: "15–65",
  },
  {
    value: "kling_mc_3.0_pro",
    label: "Kling 3.0 Pro Motion Control",
    desc: "High quality motion control",
    resolution: "1080p" as const,
    creditRange: "30–175",
  },
  {
    value: "kling_mc_3.0_std",
    label: "Kling 3.0 Standard Motion Control",
    desc: "Standard motion control",
    resolution: "720p" as const,
    creditRange: "25–130",
  },
];

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

interface UploadState {
  file: File | null;
  url: string | null;
  uploading: boolean;
  progress: number;
  previewUrl: string | null;
}

const emptyUpload: UploadState = {
  file: null,
  url: null,
  uploading: false,
  progress: 0,
  previewUrl: null,
};

interface MotionUploadFormProps {
  onSubmit: (params: {
    model: string;
    prompt: string;
    motion_video_url: string;
    character_image_url: string;
    resolution: string;
    keep_sound: boolean;
    character_orientation: "video" | "image";
  }) => Promise<string | null>;
  isSubmitting: boolean;
}

export function MotionUploadForm({
  onSubmit,
  isSubmitting,
}: MotionUploadFormProps) {
  const [keepSound, setKeepSound] = useState(true);
  const [model, setModel] = useState("kling_mc_3.0_pro");
  const [prompt, setPrompt] = useState("");
  const [characterOrientation, setCharacterOrientation] = useState<
    "video" | "image"
  >("video");
  const [motionVideo, setMotionVideo] = useState<UploadState>(emptyUpload);
  const [characterImage, setCharacterImage] =
    useState<UploadState>(emptyUpload);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { openAssets } = useAssets();

  const selectedModel = MOTION_CONTROLS_MODELS.find((m) => m.value === model);
  const resolution = selectedModel?.resolution ?? "1080p";

  const handleFileUpload = useCallback(
    async (
      file: File,
      setter: React.Dispatch<React.SetStateAction<UploadState>>,
    ) => {
      const previewUrl = URL.createObjectURL(file);
      setter({ file, url: null, uploading: true, progress: 0, previewUrl });

      try {
        const result = await uploadFileToStorage(file, (p: UploadProgress) => {
          setter((prev) => ({ ...prev, progress: p.percentage }));
        });

        if (result.success && result.blobUrl) {
          setter((prev) => ({
            ...prev,
            url: result.blobUrl!,
            uploading: false,
            progress: 100,
          }));
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setter(emptyUpload);
      }
    },
    [],
  );

  const handleVideoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleFileUpload(file, setMotionVideo);
      e.target.value = "";
    },
    [handleFileUpload],
  );

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleFileUpload(file, setCharacterImage);
      e.target.value = "";
    },
    [handleFileUpload],
  );

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("video/")) {
        toast.error("Please drop a video file");
        return;
      }
      handleFileUpload(file, setMotionVideo);
    },
    [handleFileUpload],
  );

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please drop an image file");
        return;
      }
      handleFileUpload(file, setCharacterImage);
    },
    [handleFileUpload],
  );

  const preventDefault = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const clearMotionVideo = useCallback(() => {
    if (motionVideo.previewUrl) URL.revokeObjectURL(motionVideo.previewUrl);
    setMotionVideo(emptyUpload);
  }, [motionVideo.previewUrl]);

  const clearCharacterImage = useCallback(() => {
    if (characterImage.previewUrl)
      URL.revokeObjectURL(characterImage.previewUrl);
    setCharacterImage(emptyUpload);
  }, [characterImage.previewUrl]);

  const canSubmit =
    !isSubmitting &&
    !motionVideo.uploading &&
    !characterImage.uploading &&
    !!motionVideo.url &&
    !!characterImage.url;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const id = await onSubmit({
      model,
      prompt: prompt.trim(),
      motion_video_url: motionVideo.url!,
      character_image_url: characterImage.url!,
      resolution,
      keep_sound: keepSound,
      character_orientation: characterOrientation,
    });
    if (id) {
      setPrompt("");
      clearMotionVideo();
      clearCharacterImage();
    }
  }, [
    canSubmit,
    onSubmit,
    model,
    prompt,
    motionVideo.url,
    characterImage.url,
    resolution,
    keepSound,
    characterOrientation,
    clearMotionVideo,
    clearCharacterImage,
  ]);

  return (
    <div className="flex w-full space-y-5 flex-col overflow-y-auto border-b bg-card p-4 sm:p-5 lg:h-full lg:w-[560px] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Step 1 — Motion Video */}
        <div
          className="mb-4 rounded-xl border border-dashed border-border p-5 transition-colors hover:border-primary/40"
          onDrop={handleVideoDrop}
          onDragOver={preventDefault}
        >
          {motionVideo.file || motionVideo.url ? (
            <div className="relative flex flex-col items-center gap-2">
              {motionVideo.previewUrl && (
                <video
                  src={motionVideo.previewUrl}
                  className="h-28 w-full rounded-lg object-cover"
                  muted
                  playsInline
                  autoPlay
                  loop
                />
              )}
              <div className="flex w-full items-center gap-2">
                {motionVideo.uploading ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Spinner />
                    <div className="flex-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${motionVideo.progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {motionVideo.progress}%
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle
                      className="size-3.5 text-success"
                      weight="fill"
                    />
                    <span className="truncate">
                      {motionVideo.file?.name ?? "Library asset"}
                    </span>
                  </div>
                )}
                <button
                  onClick={clearMotionVideo}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <FileVideo className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Upload motion video</p>
              <p className="text-xs text-muted-foreground">
                Video with the motion to transfer
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                MP4, WebM, MOV — drag & drop or click
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1.5 rounded-full text-xs"
                  onClick={() => videoInputRef.current?.click()}
                >
                  Browse
                </Button>
                {/* <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={() =>
                    openAssets({
                      initialTab: "video",
                      mediaTypeFilter: "video",
                      onSelect: (asset) => {
                        if (asset.mediaType !== "video") {
                          toast.error(
                            "Please select a video asset for the motion video",
                          );
                          return;
                        }
                        const url = asset.outputUrl
                          ? getCdnUrl(asset.outputUrl)
                          : null;
                        if (!url) {
                          toast.error("Selected asset has no output URL");
                          return;
                        }
                        setMotionVideo({
                          file: null,
                          url,
                          uploading: false,
                          progress: 100,
                          previewUrl: url,
                        });
                      },
                    })
                  }
                >
                  <FolderOpen className="size-3.5" />
                  Library
                </Button> */}
              </div>
            </div>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            className="hidden"
            onChange={handleVideoSelect}
          />
        </div>

        {/* Step 2 — Character Image */}
        <div
          className="rounded-xl border border-dashed border-border p-5 transition-colors hover:border-primary/40"
          onDrop={handleImageDrop}
          onDragOver={preventDefault}
        >
          {characterImage.file || characterImage.url ? (
            <div className="relative flex flex-col items-center gap-2">
              {characterImage.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={characterImage.previewUrl}
                  alt="Character"
                  className="h-28 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex w-full items-center gap-2">
                {characterImage.uploading ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Spinner />
                    <div className="flex-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${characterImage.progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {characterImage.progress}%
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle
                      className="size-3.5 text-success"
                      weight="fill"
                    />
                    <span className="truncate">
                      {characterImage.file?.name ?? "Library asset"}
                    </span>
                  </div>
                )}
                <button
                  onClick={clearCharacterImage}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <ImageSquare className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Upload character image</p>
              <p className="text-xs text-muted-foreground">
                The character to apply motion to
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                PNG, JPG, WebP — drag & drop or click
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1.5 rounded-full text-xs"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Browse
                </Button>
                {/* <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={() =>
                    openAssets({
                      initialTab: "image",
                      mediaTypeFilter: "image",
                      onSelect: (asset) => {
                        if (asset.mediaType !== "image") {
                          toast.error(
                            "Please select an image asset for the character",
                          );
                          return;
                        }
                        const url = asset.outputUrl
                          ? getCdnUrl(asset.outputUrl)
                          : null;
                        if (!url) {
                          toast.error("Selected asset has no output URL");
                          return;
                        }
                        setCharacterImage({
                          file: null,
                          url,
                          uploading: false,
                          progress: 100,
                          previewUrl: url,
                        });
                      },
                    })
                  }
                >
                  <FolderOpen className="size-3.5" />
                  Library
                </Button> */}
              </div>
            </div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>
      </div>

      {/* Model Select */}
      <Select value={model} onValueChange={(v) => v && setModel(v)}>
        <SelectTrigger
          variant="muted"
          size="sm"
          className="h-auto min-h-12 w-full py-1.5"
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium">{selectedModel?.label}</span>
            <span className="text-xs text-muted-foreground">
              {selectedModel?.desc} · {selectedModel?.resolution} ·{" "}
              {selectedModel?.creditRange} credits
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {MOTION_CONTROLS_MODELS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="text-xs text-muted-foreground">
                  {m.desc} · {m.resolution} · {m.creditRange} credits
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Character Orientation */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold">
          Character Orientation
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              value: "video" as const,
              label: "Video",
              icon: FileVideo,
              desc: "Extract character from the motion video",
            },
            {
              value: "image" as const,
              label: "Image",
              icon: ImageSquare,
              desc: "Use the uploaded character image",
            },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => setCharacterOrientation(o.value)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all",
                characterOrientation === o.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-2">
                <o.icon
                  className={cn(
                    "size-4",
                    characterOrientation === o.value
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    characterOrientation === o.value
                      ? "text-primary"
                      : "text-foreground",
                  )}
                >
                  {o.label}
                </span>
              </div>
              <span className="text-[11px] leading-snug text-muted-foreground">
                {o.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the motion or scene..."
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      {/* Keep Original Sound */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SpeakerHigh className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Keep Original Sound</span>
        </div>
        <Switch checked={keepSound} onCheckedChange={setKeepSound} />
      </div>

      {/* Resolution — locked per model */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Resolution</span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {resolution}
        </span>
      </div>

      {/* Generate button */}
      <div className="mt-auto">
        <GenerateButton
          disabled={!canSubmit}
          onClick={handleSubmit}
          submitting={isSubmitting}
          className="w-full"
        />
      </div>
    </div>
  );
}
