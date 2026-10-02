"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  Link as LinkIcon,
  Globe,
  Scissors,
  CaretDown,
  Crop,
  MagnifyingGlass,
  VideoCamera,
  ListNumbers,
  ClosedCaptioning,
  Info,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShineBorder } from "@/components/ui/shine-border";
import { Switch } from "@/components/ui/switch";
import { cn, getYouTubeVideoId, looksLikeDirectVideoUrl } from "@/lib/utils";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { toast } from "sonner";
import { LANGUAGES } from "@/constant/lang";
import {
  CAPTION_STYLE_GROUPS,
  DEFAULT_CAPTION_STYLE,
  getCaptionStyleLabel,
} from "@/constant/caption-styles";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  calculateClippingCredits,
  CLIPPING_CREDITS_PER_MINUTE,
} from "@/lib/clipping-pricing";
import type { AIClippingJob } from "@/hooks/use-ai-clippings";

const CLIPPING_PRICING_EXAMPLE_MINUTES = 20;

const CLIP_LENGTH_OPTIONS = [
  { value: "auto", label: "Auto (<90s)" },
  { value: "lt30", label: "<30s" },
  { value: "30-60", label: "30s-60s" },
  { value: "60-90", label: "60s-90s" },
  { value: "90-3min", label: "90s-3min" },
  { value: "gt3min", label: ">3min" },
];

const TARGET_DURATION_MAP: Record<string, string> = {
  auto: "DURATION_0_90",
  lt30: "DURATION_0_30",
  "30-60": "DURATION_30_60",
  "60-90": "DURATION_60_90",
  "90-3min": "DURATION_90_180",
  gt3min: "DURATION_180_300",
};

const RATIO_OPTIONS = [
  { value: "original", label: "Original", hint: "Keep the source ratio" },
  { value: "9:16", label: "9:16", hint: "TikTok / Reels / Shorts" },
  { value: "1:1", label: "1:1", hint: "Square feed posts" },
  { value: "4:5", label: "4:5", hint: "Instagram feed" },
  { value: "16:9", label: "16:9", hint: "YouTube / landscape" },
];

const MAX_CLIP_LIMIT = 20;

const MAX_MOMENTS_QUERY_LENGTH = 500;

function parseClipLimitInput(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CLIP_LIMIT) return "invalid";
  return n;
}

export function AIClippingForm({
  onJobCreated,
}: {
  onJobCreated?: (job: AIClippingJob) => void;
}) {
  const [url, setUrl] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("none");
  const [clipLength, setClipLength] = useState("auto");
  const [mode, setMode] = useState<"clips" | "moments">("clips");
  const [momentsQuery, setMomentsQuery] = useState("");
  const [ratio, setRatio] = useState("original");
  const [clipLimit, setClipLimit] = useState("");
  const [enableCaption, setEnableCaption] = useState(false);
  const [captionStyle, setCaptionStyle] = useState(DEFAULT_CAPTION_STYLE);
  const [submitting, setSubmitting] = useState(false);
  const { authFetch } = useAuthFetch();

  const hasInput = url.trim().length > 0;

  const youTubeId = useMemo(() => getYouTubeVideoId(url), [url]);

  const directVideoUrl = useMemo(() => {
    if (!url.trim()) return null;
    const t = url.trim();
    if (!looksLikeDirectVideoUrl(t)) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  }, [url]);

  const sourceLangLabel =
    sourceLang === "auto"
      ? "Auto"
      : (LANGUAGES.find((l) => l.code === sourceLang)?.name ?? sourceLang);

  const targetLangLabel =
    targetLang === "none"
      ? "No translation"
      : (LANGUAGES.find((l) => l.code === targetLang)?.name ?? targetLang);

  const langButtonLabel =
    targetLang === "none"
      ? `Auto / No translation`
      : `${sourceLangLabel} → ${targetLangLabel}`;

  const clipLengthLabel =
    CLIP_LENGTH_OPTIONS.find((o) => o.value === clipLength)?.label ??
    "Auto (<90s)";

  const ratioLabel =
    RATIO_OPTIONS.find((o) => o.value === ratio)?.label ?? "Original";

  const trimmedMomentsQuery = momentsQuery.trim();
  const isFindMoments = mode === "moments";

  const clipLimitLabel = (() => {
    const parsed = parseClipLimitInput(clipLimit);
    if (parsed === null) return "All clips";
    if (parsed === "invalid") return "All clips";
    return `${parsed} clip${parsed === 1 ? "" : "s"}`;
  })();

  const captionButtonLabel = enableCaption
    ? getCaptionStyleLabel(captionStyle)
    : "No captions";

  function clearInput() {
    setUrl("");
    setClipLimit("");
    setMomentsQuery("");
    setRatio("original");
    setEnableCaption(false);
    setCaptionStyle(DEFAULT_CAPTION_STYLE);
  }

  async function handleSubmit() {
    if (!hasInput || submitting) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error("Paste a video URL to clip");
      return;
    }

    const videoUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    const parsedLimit = parseClipLimitInput(clipLimit);
    if (parsedLimit === "invalid") {
      toast.error(
        `Enter 1–${MAX_CLIP_LIMIT} clips, or leave blank for all viral clips`,
      );
      return;
    }

    if (isFindMoments && !trimmedMomentsQuery) {
      toast.error("Describe the moments to find, e.g. “funny reactions”");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authFetch("/api/clippings/create", {
        method: "POST",
        body: JSON.stringify({
          videoUrl,
          sourceLang: sourceLang === "auto" ? null : sourceLang,
          targetLang: targetLang === "none" ? null : targetLang,
          targetDuration: TARGET_DURATION_MAP[clipLength] ?? "DURATION_0_90",
          query: isFindMoments ? trimmedMomentsQuery : null,
          limit: parsedLimit,
          ratio: ratio === "original" ? null : ratio,
          enableCaption,
          captionStyle: enableCaption ? captionStyle : null,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit clipping job");
      }

      onJobCreated?.({
        id: result.data.id,
        videoUrl: result.data.videoUrl ?? videoUrl,
        status: result.data.status ?? "QUEUED",
        config: result.data.config ?? {
          sourceLang: sourceLang === "auto" ? null : sourceLang,
          targetLang: targetLang === "none" ? null : targetLang,
          targetDuration: TARGET_DURATION_MAP[clipLength] ?? "DURATION_0_90",
          query: isFindMoments ? trimmedMomentsQuery : null,
          limit: parsedLimit,
          ratio: ratio === "original" ? null : ratio,
          enableCaption,
          captionStyle: enableCaption ? captionStyle : null,
        },
        createdAt: result.data.createdAt ?? new Date().toISOString(),
        clips: result.data.clips ?? [],
      });

      toast.success("Clipping job submitted");
      clearInput();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to submit clipping job",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={BOTTOM_PROMPT_DOCK_CLASS}>
      <div className="w-full max-w-3xl pointer-events-auto">
        <div className="rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md">
          <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />

          {hasInput && (
            <div className="border-b px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
                <div className="relative mx-auto aspect-video w-full max-w-[min(100%,320px)] shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60 sm:mx-0 sm:w-48 md:w-56">
                  {youTubeId ? (
                    <Image
                      src={`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`}
                      alt="YouTube thumbnail preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 224px"
                      priority={false}
                    />
                  ) : directVideoUrl ? (
                    <video
                      src={directVideoUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      aria-label="Video preview"
                    />
                  ) : (
                    <div className="flex h-full min-h-30 w-full items-center justify-center bg-linear-to-br from-muted to-muted/60">
                      <VideoCamera
                        className="size-12 text-muted-foreground/45"
                        weight="fill"
                      />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="wrap-break-word text-sm font-medium leading-snug text-foreground sm:line-clamp-4">
                      {url}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {youTubeId
                        ? "YouTube · thumbnail preview"
                        : directVideoUrl
                          ? "Direct video link"
                          : "Video link"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearInput}
                    className="mt-0.5 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground sm:mt-0"
                    aria-label="Remove video"
                  >
                    <X className="size-4" weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-1">
            <div className="flex items-center rounded-lg bg-muted/70 p-0.5">
              <button
                type="button"
                onClick={() => setMode("clips")}
                disabled={submitting}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  !isFindMoments
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Scissors className="size-3.5" weight="regular" />
                Viral clips
              </button>
              <button
                type="button"
                onClick={() => setMode("moments")}
                disabled={submitting}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  isFindMoments
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MagnifyingGlass className="size-3.5" weight="regular" />
                Find moments
              </button>
            </div>

            <div className="flex flex-wrap items-center divide-x divide-border/60">
              <div className="pr-1">
                <Popover>
                  <PopoverTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      className="h-8 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                      <Globe className="size-3.5" weight="regular" />
                      <span className="max-w-35 truncate">{langButtonLabel}</span>
                      <CaretDown className="size-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-120 max-w-[calc(100vw-2rem)]"
                    side="top"
                    align="start"
                    sideOffset={8}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <LanguageColumn
                        title="Source Language"
                        selected={sourceLang}
                        onSelect={setSourceLang}
                        firstOption={{ code: "auto", label: "Auto" }}
                      />
                      <LanguageColumn
                        title="Target Language"
                        selected={targetLang}
                        onSelect={setTargetLang}
                        firstOption={{ code: "none", label: "No translation" }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="px-1">
                <Popover>
                  <PopoverTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting || isFindMoments}
                      className="h-8 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                      <Scissors className="size-3.5" weight="regular" />
                      <span>{clipLengthLabel}</span>
                      <CaretDown className="size-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64"
                    side="top"
                    align="start"
                    sideOffset={8}
                  >
                    <div className="space-y-1">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        Clip Length
                      </p>
                      {CLIP_LENGTH_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setClipLength(opt.value)}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors",
                            clipLength === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-primary/10",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="px-1">
                <Popover>
                  <PopoverTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      className="h-8 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                      <Crop className="size-3.5" weight="regular" />
                      <span>{ratioLabel}</span>
                      <CaretDown className="size-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64"
                    side="top"
                    align="start"
                    sideOffset={8}
                  >
                    <div className="space-y-1">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        Aspect Ratio
                      </p>
                      {RATIO_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setRatio(opt.value)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors",
                            ratio === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-primary/10",
                          )}
                        >
                          <span>{opt.label}</span>
                          <span
                            className={cn(
                              "text-[11px] font-normal",
                              ratio === opt.value
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground/70",
                            )}
                          >
                            {opt.hint}
                          </span>
                        </button>
                      ))}
                      <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                        AI reframe keeps the main subject centered when
                        cropping.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="px-1">
                <Popover>
                  <PopoverTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      className="h-8 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                      <ListNumbers className="size-3.5" weight="regular" />
                      <span>{clipLimitLabel}</span>
                      <CaretDown className="size-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56"
                    side="top"
                    align="start"
                    sideOffset={8}
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Number of Clips
                      </p>
                      <input
                        type="number"
                        min={1}
                        max={MAX_CLIP_LIMIT}
                        step={1}
                        value={clipLimit}
                        onChange={(e) => setClipLimit(e.target.value)}
                        disabled={submitting}
                        placeholder="All viral clips"
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Max {MAX_CLIP_LIMIT} clips by virality score, highest
                        first. Leave blank to return all viral-worthy clips.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="pl-1">
                <Popover>
                  <PopoverTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      className="h-8 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                      <ClosedCaptioning className="size-3.5" weight="regular" />
                      <span className="max-w-28 truncate">
                        {captionButtonLabel}
                      </span>
                      <CaretDown className="size-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72 max-h-80 overflow-hidden p-0"
                    side="top"
                    align="start"
                    sideOffset={8}
                  >
                    <div className="border-b px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            Animated captions
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Burn captions into exported clips
                          </p>
                        </div>
                        <Switch
                          checked={enableCaption}
                          onCheckedChange={setEnableCaption}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    {enableCaption && (
                      <div className="max-h-56 overflow-y-auto p-2">
                        {CAPTION_STYLE_GROUPS.map((group) => (
                          <div key={group.label} className="mb-2 last:mb-0">
                            <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                              {group.label}
                            </p>
                            <div className="space-y-0.5">
                              {group.styles.map((style) => (
                                <button
                                  key={style.id}
                                  type="button"
                                  onClick={() => setCaptionStyle(style.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                                    captionStyle === style.id
                                      ? "bg-primary/10 text-primary"
                                      : "text-foreground hover:bg-muted",
                                  )}
                                >
                                  <span>{style.label}</span>
                                  {captionStyle === style.id && (
                                    <span className="text-primary">✓</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {isFindMoments && (
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
              <MagnifyingGlass
                className="size-4 shrink-0 text-muted-foreground"
                weight="regular"
              />
              <input
                type="text"
                value={momentsQuery}
                onChange={(e) => setMomentsQuery(e.target.value)}
                disabled={submitting}
                maxLength={MAX_MOMENTS_QUERY_LENGTH}
                placeholder='Describe the moments to find — e.g. "funny reactions", "goal moments"'
                className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
              />
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2 px-4 pb-3 pt-2">
            {!hasInput ? (
              <div className="relative flex min-w-0 flex-1 items-center gap-2">
                <LinkIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  weight="regular"
                />
                <input
                  type="url"
                  placeholder="Paste a YouTube link or video URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={submitting}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}

            <div className="flex shrink-0 items-center">
              <GenerateButton
                label="One Click to Clip"
                disabled={!hasInput}
                submitting={submitting}
                onClick={handleSubmit}
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-border/40 px-4 py-2">
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-muted-foreground">
                  <Info className="size-3.5 shrink-0" weight="regular" />
                  {CLIPPING_CREDITS_PER_MINUTE} credits per minute
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-xs">
                Charged from source video length when you submit. Each started
                minute costs {CLIPPING_CREDITS_PER_MINUTE} credits (minimum 1
                minute). A {CLIPPING_PRICING_EXAMPLE_MINUTES}-minute video costs{" "}
                {calculateClippingCredits(CLIPPING_PRICING_EXAMPLE_MINUTES * 60)}{" "}
                credits.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

function LanguageColumn({
  title,
  selected,
  onSelect,
  firstOption,
}: {
  title: string;
  selected: string;
  onSelect: (code: string) => void;
  firstOption: { code: string; label: string };
}) {
  const [search, setSearch] = useState("");

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="relative">
        <input
          type="text"
          placeholder="Search Language"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
      <div className="flex max-h-52 flex-col overflow-y-auto">
        {!search && (
          <button
            onClick={() => onSelect(firstOption.code)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
              selected === firstOption.code
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted",
            )}
          >
            {selected === firstOption.code && (
              <span className="text-primary">✓</span>
            )}
            {selected !== firstOption.code && <span className="w-3" />}
            {firstOption.label}
          </button>
        )}
        {filtered.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onSelect(lang.code)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
              selected === lang.code
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted",
            )}
          >
            {selected === lang.code ? (
              <span className="text-primary">✓</span>
            ) : (
              <span className="w-3" />
            )}
            <span className="flex flex-col">
              <span>{lang.name}</span>
              <span className="text-muted-foreground">{lang.native}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
