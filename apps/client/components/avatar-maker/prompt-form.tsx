"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  Info,
  Microphone,
  UploadSimple,
  Waveform,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { GHOST_TRIGGER_CLASS } from "@/components/generator/param-control";
import {
  ComposerCard,
  ComposerDivider,
  ComposerDock,
  ComposerFooter,
  ComposerPrompt,
  ComposerToolbar,
} from "@/components/generator/prompt-composer";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Popover,
  PopoverContent,
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
import { VoiceSelector } from "@/components/voice-generator/voice-selector";
import {
  AVATAR_MAX_AUDIO_SECONDS,
  AVATAR_RECOMMENDED_SECONDS,
  estimateSpeechSeconds,
} from "@/lib/avatar-speech";
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

/** Stock portraits offered in the portrait picker. */
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

const MODES = [
  { value: "script", label: "Script" },
  { value: "upload", label: "My recording" },
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

function PortraitTile({
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
        "relative aspect-square overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-primary",
      )}
    >
      {local ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Image src={src} alt="" fill sizes="64px" className="object-cover" />
      )}
      {selected ? (
        <span className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check weight="bold" className="size-2.5" />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Footer chip showing the chosen portrait. Opens a picker with upload, recent
 * uploads, the stock portraits and photo tips.
 */
function PortraitPicker({
  imageUrl,
  uploadedPortraits,
  uploading,
  disabled,
  onSelect,
  onUploadClick,
}: {
  imageUrl: string;
  uploadedPortraits: UploadedPortrait[];
  uploading: boolean;
  disabled: boolean;
  onSelect: (url: string) => void;
  onUploadClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const uploaded = uploadedPortraits.find((p) => p.storageUrl === imageUrl);
  const previewSrc = uploaded?.previewUrl ?? imageUrl;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label="Portrait"
            className="pl-1.5"
          />
        }
      >
        <span className="relative size-5 shrink-0 overflow-hidden rounded-full bg-muted">
          {uploading ? (
            <Spinner className="absolute inset-0 m-auto size-3" />
          ) : uploaded ? (
            <img src={previewSrc} alt="" className="size-full object-cover" />
          ) : (
            <Image src={previewSrc} alt="" fill sizes="20px" className="object-cover" />
          )}
        </span>
        Portrait
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <div className="max-h-[min(50svh,22rem)] overflow-y-auto p-3">
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onUploadClick();
              }}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              {uploading ? <Spinner /> : <UploadSimple className="size-4" />}
              <span className="text-2xs">{uploading ? "Uploading" : "Upload"}</span>
            </button>
            {uploadedPortraits.map((portrait) => (
              <PortraitTile
                key={portrait.id}
                src={portrait.previewUrl}
                label={`Use ${portrait.name}`}
                selected={imageUrl === portrait.storageUrl}
                onClick={() => {
                  onSelect(portrait.storageUrl);
                  setOpen(false);
                }}
                local
              />
            ))}
            {PORTRAITS.map((src, index) => (
              <PortraitTile
                key={src}
                src={src}
                label={`Use stock portrait ${index + 1}`}
                selected={imageUrl === src}
                onClick={() => {
                  onSelect(src);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1.5 border-t px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Info className="size-3.5 text-muted-foreground" />
            What works best
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {PHOTO_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AvatarPromptForm({
  onSubmit,
}: {
  onSubmit: (payload: AvatarGenerationPayload) => Promise<void>;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
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
    <ComposerDock>
      <ComposerCard>
        <ComposerToolbar>
          <Select
            items={MODES}
            value={mode}
            onValueChange={(v) => {
              if (v === "script" || v === "upload") setMode(v);
            }}
            disabled={submitting}
          >
            <SelectTrigger
              variant="ghost"
              size="sm"
              aria-label="Audio source"
              className={GHOST_TRIGGER_CLASS}
            >
              {mode === "script" ? <Microphone /> : <Waveform />}
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ComposerDivider />

          {mode === "script" ? (
            <>
              <VoiceSelector
                value={voiceId}
                onChange={setVoiceId}
                disabled={submitting}
                compact
              />
              <Select
                items={EMOTIONS}
                value={emotion}
                onValueChange={(v) => v && setEmotion(v)}
                disabled={submitting}
              >
                <SelectTrigger
                  variant="ghost"
                  size="sm"
                  aria-label="Emotion"
                  className={GHOST_TRIGGER_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : null}

          <Select
            items={RESOLUTIONS}
            value={resolution}
            onValueChange={(v) => v && setResolution(v)}
            disabled={submitting}
          >
            <SelectTrigger
              variant="ghost"
              size="sm"
              aria-label="Resolution"
              className={GHOST_TRIGGER_CLASS}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ComposerToolbar>

        {mode === "script" ? (
          <>
            <ComposerPrompt
              value={transcript}
              onChange={setTranscript}
              onSubmit={() => void handleGenerate()}
              placeholder="What should the avatar say?"
              label="Script"
              disabled={submitting}
            />
            {transcript.trim().length > 0 ? (
              <p
                className={cn(
                  "px-4 pb-2 text-xs tabular-nums",
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
          </>
        ) : (
          <div className="px-3 py-3">
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              disabled={uploadingAudio || submitting}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
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
          </div>
        )}

        <ComposerFooter
          start={
            <PortraitPicker
              imageUrl={imageUrl}
              uploadedPortraits={uploadedPortraits}
              uploading={uploadingImage}
              disabled={submitting}
              onSelect={setImageUrl}
              onUploadClick={() => imageInputRef.current?.click()}
            />
          }
          end={
            <GenerateButton
              credits={CREDITS}
              disabled={!canSubmit}
              submitting={submitting}
              submitState={uploading ? "uploading" : undefined}
              onClick={handleGenerate}
            />
          }
        />
      </ComposerCard>

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
    </ComposerDock>
  );
}
