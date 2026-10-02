"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  Info,
  Microphone,
  SquaresFour,
  UploadSimple,
  Waveform,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VoiceSelector } from "@/components/voice-generator/voice-selector";
import {
  AVATAR_MAX_AUDIO_SECONDS,
  AVATAR_RECOMMENDED_SECONDS,
  estimateSpeechSeconds,
} from "@/lib/avatar-speech";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";
import { cn } from "@/lib/utils";

const CREDITS = 10;

const PHOTO_TIPS = [
  "Crop to face and shoulders, with hands out of frame.",
  "Face the camera with a neutral expression or a soft smile.",
  "Use a plain background and even lighting.",
  "Skip glasses and busy scenes. Simple photos look more natural.",
];

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=80`;

/** Stock portraits. The first three are shown in the dock. */
const PORTRAITS = [
  unsplash("photo-1534528741775-53994a69daeb"),
  unsplash("photo-1529626455594-4ff0802cfb7e"),
  unsplash("photo-1580489944761-15a19d654956"),
  unsplash("photo-1531746020798-e6953c6e8e04"),
  unsplash("photo-1573496359142-b8d87734a5a2"),
  unsplash("photo-1531123897727-8f129e1688ce"),
  unsplash("photo-1507003211169-0a1dd7228f2d"),
  unsplash("photo-1506794778202-cad84cf45f1d"),
  unsplash("photo-1544005313-94ddf0286df2"),
  unsplash("photo-1552058544-f2b08422138a"),
  unsplash("photo-1494790108377-be9c29b29330"),
  unsplash("photo-1500648767791-00dcc994a43e"),
];

const EMOTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "happy", label: "Happy" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "surprised", label: "Surprised" },
  { value: "excited", label: "Excited" },
];

const RESOLUTIONS = [
  { value: "480p", label: "480p" },
  { value: "720p", label: "720p" },
];

export interface AvatarGenerationPayload {
  transcript?: string;
  audio_url?: string;
  image_url: string;
  emotion: string;
  resolution: string;
  voice_id: string;
}

interface UploadedPortrait {
  id: string;
  storageUrl: string;
  previewUrl: string;
  name: string;
}

async function uploadFile(file: File) {
  const signed = await getSignedUploadUrl(file.name, file.type);
  if (!signed.success || !signed.uploadUrl) {
    throw new Error(signed.error || "Upload failed.");
  }
  const result = await uploadToSignedUrl(file, signed);
  if (!result.success || !result.blobUrl) {
    throw new Error(result.error || "Upload failed.");
  }
  return result.blobUrl;
}

function PortraitButton({
  src,
  label,
  selected,
  onClick,
  local,
}: {
  src: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  /** Local blob previews can't go through the image optimizer. */
  local?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
    >
      {local ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Image src={src} alt="" width={64} height={64} className="size-full object-cover" />
      )}
      {selected ? (
        <span className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-foreground text-background">
          <Check weight="bold" className="size-2.5" />
        </span>
      ) : null}
    </button>
  );
}

export function AvatarPromptForm({
  onSubmit,
}: {
  onSubmit: (payload: AvatarGenerationPayload) => Promise<void>;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(PORTRAITS[0]);
  const [uploadedPortraits, setUploadedPortraits] = useState<
    UploadedPortrait[]
  >([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mode, setMode] = useState<"script" | "upload">("script");
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [emotion, setEmotion] = useState("neutral");
  const [resolution, setResolution] = useState("480p");
  const [voiceId, setVoiceId] = useState("Friendly_Person");
  const [submitting, setSubmitting] = useState(false);

  // Revoke local previews on unmount.
  const portraitsRef = useRef(uploadedPortraits);
  useEffect(() => {
    portraitsRef.current = uploadedPortraits;
  }, [uploadedPortraits]);
  useEffect(
    () => () => {
      portraitsRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    },
    [],
  );

  const speechSeconds = estimateSpeechSeconds(transcript);
  const speechTooLong = speechSeconds > AVATAR_MAX_AUDIO_SECONDS;
  const uploading = uploadingImage || uploadingAudio;

  const canSubmit =
    !submitting &&
    !uploading &&
    imageUrl.length > 0 &&
    (mode === "upload"
      ? Boolean(audioUrl)
      : transcript.trim().length > 0 && !speechTooLong);

  const inLibrary = PORTRAITS.includes(imageUrl);
  const dockPortraits = PORTRAITS.slice(0, 3);
  // Keep a library pick visible in the dock.
  if (inLibrary && !dockPortraits.includes(imageUrl)) {
    dockPortraits.unshift(imageUrl);
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a JPEG, PNG or WebP portrait.");
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      const portrait: UploadedPortrait = {
        id: crypto.randomUUID(),
        storageUrl: url,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      };
      setUploadedPortraits((prev) => {
        const next = [portrait, ...prev];
        next.slice(6).forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return next.slice(0, 6);
      });
      setImageUrl(url);
    } catch (err) {
      toast.error(
        `Couldn't upload ${file.name}. ${err instanceof Error ? err.message : "Try again."}`,
      );
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleAudioUpload(file: File) {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      toast.error("Choose an audio or video file, like MP3, WAV or MP4.");
      return;
    }
    setUploadingAudio(true);
    try {
      const url = await uploadFile(file);
      setAudioUrl(url);
      setAudioName(file.name);
    } catch (err) {
      toast.error(
        `Couldn't upload ${file.name}. ${err instanceof Error ? err.message : "Try again."}`,
      );
    } finally {
      setUploadingAudio(false);
    }
  }

  async function handleGenerate() {
    if (!canSubmit) return;
    const base = {
      image_url: imageUrl,
      emotion: emotion === "excited" ? "happy" : emotion,
      resolution,
      voice_id: voiceId,
    };
    setSubmitting(true);
    try {
      if (mode === "upload" && audioUrl) {
        await onSubmit({ ...base, audio_url: audioUrl });
      } else {
        await onSubmit({ ...base, transcript: transcript.trim() });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={BOTTOM_PROMPT_DOCK_CLASS}>
        <div className="pointer-events-auto w-full max-w-3xl rounded-xl border border-border/70 bg-card shadow-lg shadow-foreground/5">
          <div className="space-y-2 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Portrait</span>
              <Popover>
                <PopoverTrigger
                  render={<Button type="button" variant="ghost" size="xs" />}
                >
                  <Info />
                  Photo tips
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-72">
                  <PopoverHeader>
                    <PopoverTitle>What works best</PopoverTitle>
                  </PopoverHeader>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {PHOTO_TIPS.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            </div>

            <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage || submitting}
                className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                {uploadingImage ? <Spinner /> : <UploadSimple className="size-4" />}
                <span className="text-xs">
                  {uploadingImage ? "Uploading" : "Upload"}
                </span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                  e.target.value = "";
                }}
              />

              {uploadedPortraits.map((portrait) => (
                <PortraitButton
                  key={portrait.id}
                  src={portrait.previewUrl}
                  label={`Use ${portrait.name}`}
                  selected={imageUrl === portrait.storageUrl}
                  onClick={() => setImageUrl(portrait.storageUrl)}
                  local
                />
              ))}

              {dockPortraits.map((src) => (
                <PortraitButton
                  key={src}
                  src={src}
                  label={`Use stock portrait ${PORTRAITS.indexOf(src) + 1}`}
                  selected={imageUrl === src}
                  onClick={() => setImageUrl(src)}
                />
              ))}

              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-muted text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <SquaresFour className="size-4" />
                <span className="text-xs">More</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 px-4 pt-3">
            <ToggleGroup
              value={[mode]}
              onValueChange={(value) => {
                const next = value[0];
                if (next === "script" || next === "upload") setMode(next);
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Audio source"
            >
              <ToggleGroupItem value="script">
                <Microphone />
                Script
              </ToggleGroupItem>
              <ToggleGroupItem value="upload">
                <Waveform />
                My recording
              </ToggleGroupItem>
            </ToggleGroup>

            {mode === "script" ? (
              <div className="space-y-1.5">
                <Textarea
                  aria-label="Script"
                  placeholder="What should the avatar say?"
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={submitting}
                  className="field-sizing-fixed resize-none text-sm"
                />
                {transcript.trim().length > 0 ? (
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      speechTooLong
                        ? "text-destructive"
                        : speechSeconds > AVATAR_RECOMMENDED_SECONDS
                          ? "text-warning"
                          : "text-muted-foreground",
                    )}
                  >
                    {speechTooLong
                      ? `About ${speechSeconds} seconds of speech. Keep it under ${AVATAR_MAX_AUDIO_SECONDS} seconds.`
                      : speechSeconds > AVATAR_RECOMMENDED_SECONDS
                        ? `About ${speechSeconds} seconds of speech. Shorter scripts look more natural.`
                        : `About ${speechSeconds} seconds of speech.`}
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={uploadingAudio || submitting}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {uploadingAudio ? (
                    <Spinner />
                  ) : audioUrl ? (
                    <Check />
                  ) : (
                    <UploadSimple />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {uploadingAudio
                      ? "Uploading"
                      : (audioName ?? "Upload audio or video")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {audioUrl
                      ? "Click to replace. The avatar lip-syncs to this file."
                      : "MP3, WAV, M4A or MP4"}
                  </span>
                </span>
              </button>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,video/mp4"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAudioUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
            <Select
              items={RESOLUTIONS}
              value={resolution}
              onValueChange={(v) => v && setResolution(v)}
              disabled={submitting}
            >
              <SelectTrigger size="sm" aria-label="Resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {mode === "script" ? (
              <>
                <Select
                  items={EMOTIONS}
                  value={emotion}
                  onValueChange={(v) => v && setEmotion(v)}
                  disabled={submitting}
                >
                  <SelectTrigger size="sm" aria-label="Emotion">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <VoiceSelector
                  value={voiceId}
                  onChange={setVoiceId}
                  disabled={submitting}
                  compact
                />
              </>
            ) : null}

            <GenerateButton
              label="Generate"
              credits={CREDITS}
              disabled={!canSubmit}
              submitting={submitting}
              submitState={uploading ? "uploading" : undefined}
              onClick={handleGenerate}
              className="ml-auto"
            />
          </div>
        </div>
      </div>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock portraits</DialogTitle>
            <DialogDescription>
              Pick a portrait, or upload your own photo from the composer.
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-6 overflow-y-auto px-6 pb-1">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {PORTRAITS.map((src, index) => {
                const selected = imageUrl === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      setImageUrl(src);
                      setLibraryOpen(false);
                    }}
                    aria-label={`Use stock portrait ${index + 1}`}
                    aria-pressed={selected}
                    className={cn(
                      "relative aspect-3/4 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected &&
                        "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                    )}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 160px, 30vw"
                      className="object-cover"
                    />
                    {selected ? (
                      <span className="absolute right-2 bottom-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                        <Check weight="bold" className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
