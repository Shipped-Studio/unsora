"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CaretDown,
  ClosedCaptioning,
  Globe,
  Link as LinkIcon,
  MagnifyingGlass,
  Scissors,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CAPTION_STYLE_GROUPS,
  DEFAULT_CAPTION_STYLE,
  getCaptionStyleLabel,
} from "@/constant/caption-styles";
import { LANGUAGES } from "@/constant/lang";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { AIClippingJob } from "@/hooks/use-ai-clippings";
import { CLIPPING_CREDITS_PER_MINUTE } from "@/lib/clipping-pricing";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { getYouTubeVideoId, looksLikeDirectVideoUrl } from "@/lib/utils";

const CLIP_LENGTHS = [
  { value: "DURATION_0_90", label: "Auto length" },
  { value: "DURATION_0_30", label: "Under 30s" },
  { value: "DURATION_30_60", label: "30 to 60s" },
  { value: "DURATION_60_90", label: "60 to 90s" },
  { value: "DURATION_90_180", label: "90s to 3 min" },
  { value: "DURATION_180_300", label: "3 to 5 min" },
];

const RATIOS = [
  { value: "original", label: "Original ratio", hint: "Keep the source ratio" },
  { value: "9:16", label: "9:16", hint: "Reels, Shorts, TikTok" },
  { value: "1:1", label: "1:1", hint: "Square feed posts" },
  { value: "4:5", label: "4:5", hint: "Instagram feed" },
  { value: "16:9", label: "16:9", hint: "YouTube, landscape" },
];

const MAX_CLIPS = 20;
const CLIP_LIMITS = [
  { value: "all", label: "All clips" },
  ...Array.from({ length: MAX_CLIPS }, (_, i) => ({
    value: String(i + 1),
    label: i === 0 ? "1 clip" : `${i + 1} clips`,
  })),
];

const MAX_QUERY_LENGTH = 500;

function languageName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export function AIClippingForm({
  onJobCreated,
}: {
  onJobCreated: (job: AIClippingJob) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"clips" | "moments">("clips");
  const [query, setQuery] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("none");
  const [clipLength, setClipLength] = useState(CLIP_LENGTHS[0].value);
  const [ratio, setRatio] = useState("original");
  const [clipLimit, setClipLimit] = useState("all");
  const [enableCaption, setEnableCaption] = useState(false);
  const [captionStyle, setCaptionStyle] = useState(DEFAULT_CAPTION_STYLE);
  const [submitting, setSubmitting] = useState(false);

  const trimmedUrl = url.trim();
  const hasUrl = trimmedUrl.length > 0;
  const looksLikeLink = /^(https?:\/\/)?[^\s/]+\.[^\s]+/i.test(trimmedUrl);
  const findMoments = mode === "moments";
  const trimmedQuery = query.trim();
  const youTubeId = useMemo(() => getYouTubeVideoId(url), [url]);
  const directVideoUrl = useMemo(() => {
    if (!trimmedUrl || !looksLikeDirectVideoUrl(trimmedUrl)) return null;
    return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  }, [trimmedUrl]);

  const languageLabel =
    sourceLang === "auto" && targetLang === "none"
      ? "Auto language"
      : targetLang === "none"
        ? languageName(sourceLang)
        : `${sourceLang === "auto" ? "Auto" : languageName(sourceLang)} to ${languageName(targetLang)}`;

  const canSubmit =
    hasUrl && !submitting && (!findMoments || trimmedQuery.length > 0);

  function reset() {
    setUrl("");
    setQuery("");
    setClipLimit("all");
    setRatio("original");
    setEnableCaption(false);
    setCaptionStyle(DEFAULT_CAPTION_STYLE);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const videoUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    const config = {
      sourceLang: sourceLang === "auto" ? null : sourceLang,
      targetLang: targetLang === "none" ? null : targetLang,
      targetDuration: clipLength,
      query: findMoments ? trimmedQuery : null,
      limit: clipLimit === "all" ? null : Number(clipLimit),
      ratio: ratio === "original" ? null : ratio,
      enableCaption,
      captionStyle: enableCaption ? captionStyle : null,
    };

    setSubmitting(true);
    try {
      const res = await authFetch("/api/clippings/create", {
        method: "POST",
        body: JSON.stringify({ videoUrl, ...config }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.error || "Couldn't start clipping. Try again.");
        return;
      }

      onJobCreated({
        id: body.data.id,
        videoUrl: body.data.videoUrl ?? videoUrl,
        status: body.data.status ?? "QUEUED",
        config: body.data.config ?? config,
        createdAt: body.data.createdAt ?? new Date().toISOString(),
        clips: body.data.clips ?? [],
      });
      reset();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={BOTTOM_PROMPT_DOCK_CLASS}>
      <div className="pointer-events-auto w-full max-w-3xl rounded-xl border border-border/70 bg-card shadow-lg shadow-foreground/5">
        {looksLikeLink ? (
          <div className="flex items-center gap-3 border-b p-3">
            <div className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted sm:w-36">
              {youTubeId ? (
                <Image
                  src={`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : directVideoUrl ? (
                <video
                  src={directVideoUrl}
                  className="size-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <VideoCamera className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium break-all">
                {trimmedUrl}
              </p>
              <p className="text-xs text-muted-foreground">
                {youTubeId
                  ? "YouTube video"
                  : directVideoUrl
                    ? "Video file link"
                    : "Video link"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setUrl("")}
              disabled={submitting}
              aria-label="Remove video link"
            >
              <X />
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
          <ToggleGroup
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "clips" || next === "moments") setMode(next);
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="What to find"
          >
            <ToggleGroupItem value="clips">
              <Scissors />
              Best clips
            </ToggleGroupItem>
            <ToggleGroupItem value="moments">
              <MagnifyingGlass />
              Find moments
            </ToggleGroupItem>
          </ToggleGroup>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  className="text-muted-foreground"
                />
              }
            >
              <Globe />
              <span className="max-w-40 truncate">{languageLabel}</span>
              <CaretDown className="size-3" />
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-[min(calc(100vw-2rem),32rem)] gap-3 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <LanguageList
                  title="Spoken language"
                  selected={sourceLang}
                  onSelect={setSourceLang}
                  first={{ code: "auto", label: "Detect automatically" }}
                />
                <LanguageList
                  title="Translate captions to"
                  selected={targetLang}
                  onSelect={setTargetLang}
                  first={{ code: "none", label: "Don't translate" }}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Select
            items={CLIP_LENGTHS}
            value={clipLength}
            onValueChange={(v) => v && setClipLength(v)}
            disabled={submitting || findMoments}
          >
            <SelectTrigger variant="ghost" size="sm" aria-label="Clip length">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIP_LENGTHS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={RATIOS}
            value={ratio}
            onValueChange={(v) => v && setRatio(v)}
            disabled={submitting}
          >
            <SelectTrigger variant="ghost" size="sm" aria-label="Aspect ratio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RATIOS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  <span className="text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={CLIP_LIMITS}
            value={clipLimit}
            onValueChange={(v) => v && setClipLimit(v)}
            disabled={submitting}
          >
            <SelectTrigger variant="ghost" size="sm" aria-label="Number of clips">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIP_LIMITS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  className="text-muted-foreground"
                />
              }
            >
              <ClosedCaptioning />
              <span className="max-w-32 truncate">
                {enableCaption ? getCaptionStyleLabel(captionStyle) : "No captions"}
              </span>
              <CaretDown className="size-3" />
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-72 gap-0 p-0">
              <div className="flex items-center justify-between gap-3 border-b p-3">
                <div>
                  <Label htmlFor="clip-captions">Captions</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Burned into each clip
                  </p>
                </div>
                <Switch
                  id="clip-captions"
                  checked={enableCaption}
                  onCheckedChange={setEnableCaption}
                />
              </div>
              {enableCaption ? (
                <Command className="rounded-none! p-0">
                  <CommandList className="max-h-60">
                    {CAPTION_STYLE_GROUPS.map((group) => (
                      <CommandGroup key={group.label} heading={group.label}>
                        {group.styles.map((style) => (
                          <CommandItem
                            key={style.id}
                            value={`${group.label} ${style.label} ${style.id}`}
                            data-checked={captionStyle === style.id}
                            onSelect={() => setCaptionStyle(style.id)}
                          >
                            {style.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>

        {findMoments ? (
          <div className="px-3 pt-2">
            <InputGroup>
              <InputGroupAddon>
                <MagnifyingGlass />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={submitting}
                maxLength={MAX_QUERY_LENGTH}
                placeholder="Moments to find, like “funny reactions” or “goals”"
                aria-label="Moments to find"
              />
            </InputGroup>
          </div>
        ) : null}

        <div className="flex items-center gap-2 p-3">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <LinkIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
              disabled={submitting}
              placeholder="Paste a YouTube or video link"
              aria-label="Video link"
            />
          </InputGroup>
          <GenerateButton
            label="Get clips"
            disabled={!canSubmit}
            submitting={submitting}
            onClick={handleSubmit}
          />
        </div>
        <p className="-mt-1 px-3 pb-3 text-xs text-muted-foreground">
          {CLIPPING_CREDITS_PER_MINUTE} credits per minute of source video,
          charged when you start.
        </p>
      </div>
    </div>
  );
}

function LanguageList({
  title,
  selected,
  onSelect,
  first,
}: {
  title: string;
  selected: string;
  onSelect: (code: string) => void;
  first: { code: string; label: string };
}) {
  return (
    <Command className="rounded-lg! border p-0">
      <CommandInput placeholder="Search languages" aria-label={`${title}: search`} />
      <CommandList className="max-h-52">
        <CommandEmpty>No matching language</CommandEmpty>
        <CommandGroup heading={title}>
          <CommandItem
            value={first.label}
            data-checked={selected === first.code}
            onSelect={() => onSelect(first.code)}
          >
            {first.label}
          </CommandItem>
          {LANGUAGES.map((language) => (
            <CommandItem
              key={language.code}
              value={`${language.name} ${language.native} ${language.code}`}
              data-checked={selected === language.code}
              onSelect={() => onSelect(language.code)}
            >
              <span className="truncate">{language.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {language.native}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
