"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Fire,
  MagnifyingGlass,
  Sparkle,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { failureMessage } from "@/components/subtitle-editor/format";
import type {
  BrollMedia,
  BrollOrientation,
  useSubtitleApi,
} from "@/hooks/subtitle/use-subtitle-api";
import { useLibrary } from "@/hooks/use-library";
import { uploadFileToStorage } from "@/lib/storage-client";
import { cn } from "@/lib/utils";

type Api = ReturnType<typeof useSubtitleApi>;
type Source = "video" | "image" | "ai" | "assets";
type Tier = "trendy" | "free" | "premium";

const AI_IMAGE_CREDITS = 2;
const SEARCH_DELAY_MS = 400;

const SOURCES: { value: Source; label: string }[] = [
  { value: "video", label: "Video Stock" },
  { value: "image", label: "Image Stock" },
  { value: "ai", label: "AI Generated" },
  { value: "assets", label: "My Assets" },
];

const TIERS: { value: Tier; label: string }[] = [
  { value: "trendy", label: "Trendy" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

/** "00:29" */
const clock = (seconds: number) => {
  const s = Math.round(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The B-roll library that slides in over the B-rolls tab, as in Submagic:
 * stock video and images, AI images and the user's own files.
 */
export function BrollPicker({
  api,
  orientation,
  initialQuery,
  initialSource,
  onBack,
  onPick,
}: {
  api: Api;
  orientation: BrollOrientation;
  initialQuery: string;
  initialSource: "video" | "image";
  onBack: () => void;
  onPick: (media: BrollMedia) => void;
}) {
  const [source, setSource] = useState<Source>(initialSource);
  const [tier, setTier] = useState<Tier>("trendy");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BrollMedia[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const searchId = useRef(0);

  /**
   * Stock photos are copied to our storage before they go in the video:
   * Pixabay doesn't allow keeping its image URLs. Its videos may be used
   * directly, so they're picked as they are.
   */
  const pickStock = async (media: BrollMedia) => {
    if (media.kind !== "image" || media.vendor !== "pixabay") {
      onPick(media);
      return;
    }
    if (isImporting) return;
    setIsImporting(true);
    const result = await api.importBroll(media.url);
    setIsImporting(false);
    if (!result.success || !result.data) {
      toast.error(failureMessage("add the image", result.error));
      return;
    }
    onPick({ ...media, url: result.data.url, thumbnailUrl: result.data.url });
  };

  // Search as the user types, and whenever the source or tier changes.
  useEffect(() => {
    if (source !== "video" && source !== "image") return;
    const text = query.trim();
    if (!text) return;
    const id = ++searchId.current;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      const result = await api.searchBroll(
        text,
        source === "video" ? "video" : "photo",
        orientation,
        tier,
      );
      if (id !== searchId.current) return;
      setIsSearching(false);
      if (!result.success || !result.data) {
        setSearchError(failureMessage("search", result.error));
        setResults([]);
        return;
      }
      setResults(result.data);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [api, query, source, tier, orientation]);

  const portrait = orientation === "portrait";

  return (
    <div className="space-y-4 duration-200 animate-in fade-in slide-in-from-right-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" aria-label="Back to scenes" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h2 className="text-sm font-medium">B-rolls</h2>
      </div>

      <div role="tablist" aria-label="B-roll source" className="flex gap-1 overflow-x-auto border-b">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={source === s.value}
            onClick={() => {
              setSource(s.value);
              setResults([]);
            }}
            className="relative shrink-0 rounded-t-md px-2.5 py-1.5 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:bg-muted aria-selected:text-foreground aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:bg-foreground"
          >
            {s.label}
          </button>
        ))}
      </div>

      {source === "video" || source === "image" ? (
        <>
          {source === "video" ? (
            <div role="group" aria-label="Video type" className="flex gap-2">
              {TIERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={tier === t.value}
                  onClick={() => setTier(t.value)}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  {t.value === "trendy" ? <Fire weight="fill" className="size-3.5 text-orange-500" /> : null}
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label={source === "video" ? "Search stock video" : "Search stock images"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-lg border bg-background pr-9 pl-8 text-sm outline-none transition-colors focus:border-[#3F83F8] [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          {searchError ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{searchError}</p>
          ) : null}
          {isImporting ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Adding image…
            </p>
          ) : null}
          <MediaGrid
            items={results}
            portrait={portrait}
            loading={isSearching && !results.length}
            onPick={(media) => void pickStock(media)}
            empty={query.trim() ? "Nothing found. Try other words." : "Search for footage."}
          />
          {results.length ? (
            // Pixabay asks that results always say where they come from.
            <p className="text-xs text-muted-foreground">
              <a href="https://pixabay.com" target="_blank" rel="noreferrer" className="underline">
                {source === "video" ? "Videos" : "Photos"} provided by Pixabay
              </a>
            </p>
          ) : null}
        </>
      ) : source === "ai" ? (
        <AiGenerated api={api} orientation={orientation} initialPrompt={initialQuery} portrait={portrait} onPick={onPick} />
      ) : (
        <MyAssets portrait={portrait} onPick={onPick} />
      )}
    </div>
  );
}

function MediaGrid({
  items,
  portrait,
  loading,
  empty,
  onPick,
}: {
  items: BrollMedia[];
  portrait: boolean;
  loading?: boolean;
  empty: string;
  onPick: (media: BrollMedia) => void;
}) {
  /** The video open in the preview, before the user decides to use it. */
  const [previewing, setPreviewing] = useState<BrollMedia | null>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={cn("animate-pulse rounded-lg bg-muted", portrait ? "aspect-[9/16]" : "aspect-video")}
          />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return <p className="rounded-xl bg-muted px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((media) => (
          <MediaTile
            key={media.url}
            media={media}
            portrait={portrait}
            // Videos open a preview first; a picture is all there in its tile.
            onClick={() => (media.kind === "video" ? setPreviewing(media) : onPick(media))}
          />
        ))}
      </div>
      <ClipPreviewDialog
        media={previewing}
        onClose={() => setPreviewing(null)}
        onUse={(media) => {
          setPreviewing(null);
          onPick(media);
        }}
      />
    </>
  );
}

/** A result; videos play, muted, while hovered. */
function MediaTile({
  media,
  portrait,
  onClick,
}: {
  media: BrollMedia;
  portrait: boolean;
  onClick: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const by = media.author ? ` by ${media.author}` : "";
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      aria-label={media.kind === "video" ? `Preview clip${by}` : `Use image${by}`}
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-[#3F83F8] focus-visible:ring-3 focus-visible:ring-ring/50",
        portrait ? "aspect-[9/16]" : "aspect-video",
      )}
    >
      {media.kind === "video" && hovering ? (
        <video
          src={media.previewUrl ?? media.url}
          poster={media.thumbnailUrl}
          muted
          autoPlay
          loop
          playsInline
          className="size-full object-cover"
        />
      ) : (
         
        <img src={media.thumbnailUrl ?? media.url} alt="" loading="lazy" className="size-full object-cover" />
      )}
      {media.duration ? (
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-black/80 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">
          {clock(media.duration)}
        </span>
      ) : null}
    </button>
  );
}

/**
 * A video at a watchable size, with controls, before it's added. It plays
 * the smaller preview file; picking it uses the full-quality one.
 */
function ClipPreviewDialog({
  media,
  onClose,
  onUse,
}: {
  /** The video to show; the dialog is open while it's set. */
  media: BrollMedia | null;
  onClose: () => void;
  onUse: (media: BrollMedia) => void;
}) {
  const site = media?.vendor === "pixabay" ? "Pixabay" : media?.vendor === "pexels" ? "Pexels" : null;
  const details = media
    ? [
        media.duration ? clock(media.duration) : null,
        media.width && media.height ? `${media.width}×${media.height}` : null,
      ].filter(Boolean)
    : [];

  return (
    <Dialog open={media !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preview clip</DialogTitle>
        </DialogHeader>
        {media ? (
          <>
            {/* Starts muted, so browsers let it autoplay; unmute with its controls. */}
            <video
              key={media.url}
              src={media.previewUrl ?? media.url}
              poster={media.thumbnailUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              aria-label="Clip preview"
              className="max-h-[60svh] w-full rounded-lg bg-black object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{details.join(" · ")}</span>
              {site && media.sourceUrl ? (
                <a href={media.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  {media.author ? `By ${media.author} on ${site}` : `From ${site}`}
                </a>
              ) : null}
            </div>
          </>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => media && onUse(media)}>Use this clip</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiGenerated({
  api,
  orientation,
  initialPrompt,
  portrait,
  onPick,
}: {
  api: Api;
  orientation: BrollOrientation;
  initialPrompt: string;
  portrait: boolean;
  onPick: (media: BrollMedia) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [made, setMade] = useState<BrollMedia[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    const result = await api.generateBrollImage(prompt.trim(), orientation);
    setIsGenerating(false);
    if (!result.success || !result.data) {
      toast.error(failureMessage("make the image", result.error));
      return;
    }
    setMade((prev) => [result.data!.media, ...prev]);
  };

  return (
    <div className="space-y-4">
      <Textarea
        aria-label="Describe the image"
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the shot, e.g. a world map on a wooden wall, close up"
      />
      <Button disabled={isGenerating || !prompt.trim()} onClick={generate}>
        {isGenerating ? <Spinner /> : <Sparkle />}
        Generate
        <span className="rounded bg-primary-foreground/20 px-1.5 text-xs tabular-nums">✦ {AI_IMAGE_CREDITS}</span>
      </Button>
      <MediaGrid
        items={made}
        portrait={portrait}
        loading={isGenerating && !made.length}
        onPick={onPick}
        empty="Images you generate show here."
      />
    </div>
  );
}

function MyAssets({
  portrait,
  onPick,
}: {
  portrait: boolean;
  onPick: (media: BrollMedia) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videos = useLibrary({ mediaType: "video" });
  const images = useLibrary({ mediaType: "image" });
  const items: BrollMedia[] = [...videos.items, ...images.items]
    .filter((item) => item.url && item.status === "COMPLETED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => ({
      kind: item.mediaType === "video" ? "video" : "image",
      url: item.url!,
      thumbnailUrl: item.thumbnailUrl ?? (item.mediaType === "image" ? item.url! : undefined),
      vendor: "upload",
    }));

  const upload = async (file: File) => {
    setIsUploading(true);
    const result = await uploadFileToStorage(file);
    setIsUploading(false);
    if (!result.success || !result.blobUrl) {
      toast.error(failureMessage("upload the file", result.error));
      return;
    }
    onPick({
      kind: file.type.startsWith("video/") ? "video" : "image",
      url: result.blobUrl,
      thumbnailUrl: file.type.startsWith("image/") ? result.blobUrl : undefined,
      vendor: "upload",
    });
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button variant="outline" disabled={isUploading} onClick={() => fileRef.current?.click()}>
        {isUploading ? <Spinner /> : <UploadSimple />}
        {isUploading ? "Uploading…" : "Upload"}
      </Button>
      <MediaGrid
        items={items}
        portrait={portrait}
        loading={(videos.isLoading || images.isLoading) && !items.length}
        onPick={onPick}
        empty="Your videos and images show here."
      />
    </div>
  );
}
