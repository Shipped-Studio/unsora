"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  SmileyWink,
  SquaresFour,
  Heart,
  CheckCircle,
  MagnifyingGlass,
  UploadSimple,
  Microphone,
  Waveform,
  Check,
  Info,
} from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { VoiceSelector } from "@/components/voice-generator/voice-selector";
import {
  AVATAR_MAX_AUDIO_SECONDS,
  AVATAR_PHOTO_TIPS,
  AVATAR_RECOMMENDED_SECONDS,
  estimateSpeechSeconds,
} from "@/lib/avatar-speech";

interface UploadedPortrait {
  id: string;
  storageUrl: string;
  previewUrl: string;
  name: string;
}

function PortraitThumb({
  src,
  alt,
  selected,
  onClick,
  badge,
  unoptimized,
}: {
  src: string;
  alt: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  unoptimized?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative size-20 shrink-0 overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-background transition-all",
        selected ? "ring-primary" : "ring-transparent hover:ring-border",
      )}
    >
      {unoptimized ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={80}
          height={80}
          className="size-full object-cover"
        />
      )}
      {badge && (
        <span className="absolute inset-x-0 bottom-0 bg-primary/90 px-1 py-0.5 text-center text-[8px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

const presetAvatars = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
];

const libraryAvatars = [
  { id: 1, src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80", category: "creative" },
  { id: 2, src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", category: "professional" },
  { id: 3, src: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80", category: "casual" },
  { id: 4, src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", category: "professional" },
  { id: 5, src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80", category: "casual" },
  { id: 6, src: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80", category: "creative" },
  { id: 7, src: "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=400&q=80", category: "professional" },
  { id: 8, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", category: "casual" },
  { id: 9, src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", category: "professional" },
  { id: 10, src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", category: "creative" },
  { id: 11, src: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80", category: "casual" },
  { id: 12, src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80", category: "creative" },
];

const filterChips = [
  "All",
  "Favorite",
  "Professional",
  "Creative",
  "Casual",
] as const;

const EMOTIONS = [
  { value: "happy", label: "Happy" },
  { value: "neutral", label: "Neutral" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "surprised", label: "Surprised" },
  { value: "excited", label: "Excited" },
] as const;

export interface AvatarGenerationPayload {
  transcript?: string;
  audio_url?: string;
  image_url: string;
  emotion: string;
  resolution: string;
  voice_id: string;
}

interface AvatarPromptFormProps {
  onSubmit: (payload: AvatarGenerationPayload) => Promise<void>;
  isSubmitting?: boolean;
}

export function AvatarPromptForm({
  onSubmit,
  isSubmitting = false,
}: AvatarPromptFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>(
    libraryAvatars[1].src,
  );
  const [favorites, setFavorites] = useState<Set<number>>(new Set([2]));
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [transcript, setTranscript] = useState("");
  const [emotion, setEmotion] = useState("neutral");
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [voiceId, setVoiceId] = useState("Friendly_Person");
  const [uploading, setUploading] = useState(false);
  const [audioMode, setAudioMode] = useState<"script" | "upload">("script");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadedPortraits, setUploadedPortraits] = useState<UploadedPortrait[]>(
    [],
  );
  const [uploadedAudioName, setUploadedAudioName] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const portraitsRef = useRef(uploadedPortraits);
  portraitsRef.current = uploadedPortraits;

  useEffect(() => {
    return () => {
      portraitsRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAvatars = libraryAvatars.filter((avatar) => {
    if (activeFilter === "Favorite") return favorites.has(avatar.id);
    if (["Professional", "Creative", "Casual"].includes(activeFilter)) {
      return avatar.category === activeFilter.toLowerCase();
    }
    return true;
  });

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a portrait image");
      return;
    }

    setUploading(true);
    try {
      const signed = await getSignedUploadUrl(file.name, file.type);
      if (!signed.success || !signed.uploadUrl) {
        throw new Error(signed.error || "Failed to get upload URL");
      }
      const result = await uploadToSignedUrl(file, signed);
      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed");
      }
      const previewUrl = URL.createObjectURL(file);
      const portrait: UploadedPortrait = {
        id: crypto.randomUUID(),
        storageUrl: result.blobUrl,
        previewUrl,
        name: file.name,
      };
      setUploadedPortraits((prev) => [portrait, ...prev].slice(0, 6));
      setSelectedImageUrl(result.blobUrl);
      toast.success("Portrait uploaded — selected for lip-sync");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleAudioUpload = useCallback(async (file: File) => {
    const isAudio =
      file.type.startsWith("audio/") || file.type.startsWith("video/");
    if (!isAudio) {
      toast.error("Upload an audio or video file");
      return;
    }
    setUploadingAudio(true);
    try {
      const signed = await getSignedUploadUrl(file.name, file.type);
      if (!signed.success || !signed.uploadUrl) {
        throw new Error(signed.error || "Failed to get upload URL");
      }
      const result = await uploadToSignedUrl(file, signed);
      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed");
      }
      setAudioUrl(result.blobUrl);
      setUploadedAudioName(file.name);
      toast.success("Audio uploaded — avatar will lip-sync to this file");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAudio(false);
    }
  }, []);

  const speechSeconds = estimateSpeechSeconds(transcript);
  const speechTooLong = speechSeconds > AVATAR_MAX_AUDIO_SECONDS;

  const canSubmit =
    !isSubmitting &&
    !uploading &&
    !uploadingAudio &&
    selectedImageUrl.length > 0 &&
    (audioMode === "upload"
      ? Boolean(audioUrl)
      : transcript.trim().length > 0 && !speechTooLong);

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    const base = {
      image_url: selectedImageUrl,
      emotion: emotion === "excited" ? "happy" : emotion,
      resolution,
      voice_id: voiceId,
    };
    if (audioMode === "upload" && audioUrl) {
      await onSubmit({ ...base, audio_url: audioUrl });
    } else {
      await onSubmit({ ...base, transcript: transcript.trim() });
    }
  }, [
    canSubmit,
    transcript,
    selectedImageUrl,
    emotion,
    voiceId,
    resolution,
    audioMode,
    audioUrl,
    onSubmit,
  ]);

  return (
    <>
      <div className={BOTTOM_PROMPT_DOCK_CLASS}>
        <div className="pointer-events-auto w-full max-w-[680px] rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-[10px] font-medium text-muted-foreground">
              Portrait
            </span>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Info className="size-3.5" weight="fill" />
                Photo tips
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="max-w-[260px] flex-col items-start gap-1.5 px-3 py-2.5 text-left"
              >
                <p className="font-semibold">Best results with your photo</p>
                <ul className="space-y-1 text-[11px] leading-snug opacity-90">
                  {AVATAR_PHOTO_TIPS.map((tip) => (
                    <li key={tip}>• {tip}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2 px-4 pb-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex size-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed transition-colors",
                uploading
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-primary/50 bg-primary/10 text-primary hover:border-primary hover:bg-primary/15",
              )}
            >
              {uploading ? (
                <Spinner className="size-5" />
              ) : (
                <UploadSimple className="size-5" weight="bold" />
              )}
              <span className="text-[10px] font-semibold leading-none">
                {uploading ? "Uploading…" : "Your photo"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />

            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none">
              {uploadedPortraits.map((portrait) => (
                <PortraitThumb
                  key={portrait.id}
                  src={portrait.previewUrl}
                  alt={portrait.name}
                  selected={selectedImageUrl === portrait.storageUrl}
                  onClick={() => setSelectedImageUrl(portrait.storageUrl)}
                  badge="Yours"
                  unoptimized
                />
              ))}

              {presetAvatars.map((src, i) => (
                <PortraitThumb
                  key={i}
                  src={src}
                  alt={`Sample avatar ${i + 1}`}
                  selected={selectedImageUrl === src}
                  onClick={() => setSelectedImageUrl(src)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setBrowseOpen(true)}
              className="flex size-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted/50 text-foreground transition-colors hover:bg-muted"
            >
              <SquaresFour className="size-5" weight="fill" />
              <span className="text-[10px] font-semibold leading-none">
                Library
              </span>
            </button>
          </div>

          <div className="px-4 pt-3">
            <div className="mb-2 flex gap-1 rounded-xl border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setAudioMode("script")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                  audioMode === "script"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Microphone className="size-3.5" weight="fill" />
                Script + AI voice
              </button>
              <button
                type="button"
                onClick={() => setAudioMode("upload")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                  audioMode === "upload"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Waveform className="size-3.5" weight="fill" />
                My recording
              </button>
            </div>

            {audioMode === "script" ? (
              <>
                <p className="mb-2 text-[10px] text-muted-foreground">
                  Type what the avatar should say — we generate speech with your
                  selected voice, then lip-sync the video. Use short sentences
                  and <strong className="font-medium text-foreground">Neutral</strong>{" "}
                  mood for the most natural look (≤{AVATAR_RECOMMENDED_SECONDS}s
                  recommended).
                </p>
                <textarea
                  placeholder="Enter the script your avatar will speak…"
                  rows={4}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full resize-none rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                {transcript.trim().length > 0 && (
                  <p
                    className={cn(
                      "mt-1.5 text-[10px]",
                      speechTooLong
                        ? "font-medium text-destructive"
                        : speechSeconds > AVATAR_RECOMMENDED_SECONDS
                          ? "text-warning"
                          : "text-muted-foreground",
                    )}
                  >
                    ~{speechSeconds}s speech
                    {speechTooLong
                      ? ` — shorten to ${AVATAR_MAX_AUDIO_SECONDS}s or less for best lip-sync`
                      : speechSeconds > AVATAR_RECOMMENDED_SECONDS
                        ? " — shorter scripts look less robotic"
                        : " — good length"}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-2 text-[10px] text-muted-foreground">
                  Upload audio you already recorded (podcast clip, voice memo,
                  etc.). The avatar lip-syncs to your file — no AI voice
                  generation.
                </p>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={uploadingAudio || isSubmitting}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 transition-colors",
                    audioUrl
                      ? "border-primary/50 bg-primary/5 text-foreground"
                      : "border-primary/40 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10",
                  )}
                >
                  {uploadingAudio ? (
                    <>
                      <Spinner className="size-5" />
                      <span className="text-xs font-medium">Uploading…</span>
                    </>
                  ) : audioUrl ? (
                    <>
                      <Check className="size-6 text-primary" weight="bold" />
                      <span className="text-xs font-semibold">
                        {uploadedAudioName ?? "Audio ready"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Tap to replace
                      </span>
                    </>
                  ) : (
                    <>
                      <Waveform className="size-6" weight="duotone" />
                      <span className="text-xs font-semibold">
                        Upload audio or video
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        MP3, WAV, M4A, or MP4
                      </span>
                    </>
                  )}
                </button>
              </>
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

          <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2.5">
            <Select
              value={resolution}
              onValueChange={(v) => v && setResolution(v as "480p" | "720p")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="480p">480p · softer</SelectItem>
                <SelectItem value="720p">720p · sharp</SelectItem>
              </SelectContent>
            </Select>

            {audioMode === "script" && (
              <>
                <Select
                  value={emotion}
                  onValueChange={(v) => v && setEmotion(v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SmileyWink className="size-3.5" weight="fill" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <VoiceSelector
                  value={voiceId}
                  onChange={setVoiceId}
                  disabled={isSubmitting}
                  compact
                  showCloneButton
                />
              </>
            )}

            {audioMode === "upload" && (
              <p className="text-[10px] text-muted-foreground">
                Voice comes from your uploaded file — pick a portrait above, then
                generate.
              </p>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <GenerateButton
                credits={10}
                disabled={!canSubmit}
                onClick={handleGenerate}
                submitting={isSubmitting}
                submitState={uploading ? "uploading" : undefined}
                label="Generate avatar"
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Avatar library
            </DialogTitle>
            <DialogDescription>
              {libraryAvatars.length} portraits available
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search avatars…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const isActive = activeFilter === chip;
              const label =
                chip === "Favorite" ? `Favorite(${favorites.size})` : chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveFilter(chip)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {chip === "Favorite" && (
                    <Heart
                      className="size-3"
                      weight={isActive ? "fill" : "regular"}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>

          <div className="-mx-4 flex-1 overflow-y-auto px-4 pb-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredAvatars.map((avatar) => {
                const isSelected = selectedImageUrl === avatar.src;
                const isFav = favorites.has(avatar.id);
                return (
                  <div
                    key={avatar.id}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border-2 transition-colors",
                      isSelected
                        ? "border-primary"
                        : "border-transparent hover:border-border",
                    )}
                  >
                    <div className="relative aspect-3/4 overflow-hidden rounded-lg">
                      <Image
                        src={avatar.src}
                        alt={`Avatar ${avatar.id}`}
                        fill
                        className="object-cover"
                      />

                      <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                        {isSelected ? (
                          <CheckCircle
                            className="size-5 text-primary"
                            weight="fill"
                          />
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(avatar.id);
                          }}
                          className="rounded-full bg-background/60 p-1 backdrop-blur-sm transition-colors hover:bg-background/80"
                        >
                          <Heart
                            className={cn(
                              "size-4",
                              isFav
                                ? "text-red-500"
                                : "text-muted-foreground",
                            )}
                            weight={isFav ? "fill" : "regular"}
                          />
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageUrl(avatar.src);
                            setBrowseOpen(false);
                          }}
                          className="w-full rounded-lg bg-background/80 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-background"
                        >
                          Select Avatar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
