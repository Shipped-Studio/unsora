"use client";

import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  YoutubeLogo,
  MonitorPlay,
} from "@phosphor-icons/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import type { ThumbnailTemplate } from "@/fake";
import thumbnailTemplatesJson from "@/constant/thumbnail-templates.json";
import { getYoutubeThumbnail, type ContextItem } from "./add-context-modal";
import {
  jsonTemplateToThumbnailTemplate,
  type ThumbnailTemplateJson,
} from "@/lib/thumbmaker-template-map";

const presetTemplates = (thumbnailTemplatesJson as ThumbnailTemplateJson[]).map(
  jsonTemplateToThumbnailTemplate,
);

const FILTER_ALL = "All";
const VISIBLE_TAG_COUNT = 6;

interface TemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: ThumbnailTemplate) => void;
  onImportContext?: (items: ContextItem[]) => void;
}

function parseYoutubeUrls(text: string): { url: string; thumbnail: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => ({ url, thumbnail: getYoutubeThumbnail(url) }))
    .filter(
      (item): item is { url: string; thumbnail: string } =>
        item.thumbnail !== null,
    );
}

export function TemplatesModal({
  open,
  onOpenChange,
  onSelect,
  onImportContext,
}: TemplatesModalProps) {
  const templates = presetTemplates;
  const [activeFilter, setActiveFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [activeImportTab, setActiveImportTab] = useState<
    "import-file" | "import-yt"
  >("import-file");

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of presetTemplates) {
      for (const tag of t.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, []);

  const visibleTags = tagOptions.slice(0, VISIBLE_TAG_COUNT);
  const moreTags = tagOptions.slice(VISIBLE_TAG_COUNT);

  const bulkPreviews = parseYoutubeUrls(bulkUrls);
  const channelPreviews = parseYoutubeUrls(channelUrl);

  const handleSaveBulk = () => {
    if (!onImportContext || bulkPreviews.length === 0) return;
    onImportContext(
      bulkPreviews.map((p) => ({
        id: crypto.randomUUID(),
        type: "youtube" as const,
        label: p.url,
        thumbnail: p.thumbnail,
      })),
    );
    setBulkUrls("");
    onOpenChange(false);
  };

  const handleSaveChannel = () => {
    if (!onImportContext || channelPreviews.length === 0) return;
    onImportContext(
      channelPreviews.map((p) => ({
        id: crypto.randomUUID(),
        type: "youtube" as const,
        label: p.url,
        thumbnail: p.thumbnail,
      })),
    );
    setChannelUrl("");
    onOpenChange(false);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesTag =
      activeFilter === FILTER_ALL ? true : t.tags.includes(activeFilter);
    const matchesSearch =
      !search || t.title.toLowerCase().includes(search.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <Tabs
          defaultValue="browse"
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 pt-5 pb-3">
            <TabsList>
              <TabsTrigger value="browse">
                <MonitorPlay className="size-4" />
                Browse from Library
              </TabsTrigger>
              <TabsTrigger value="import">
                <YoutubeLogo className="size-4" weight="fill" />
                Import from Youtube
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="browse"
            className="flex-1 flex flex-col overflow-hidden px-6 pt-4 pb-6 mt-0"
          >
            <div className="mb-3">
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="mr-0.5 text-xs text-muted-foreground">Tags</span>
              <Button
                type="button"
                variant={activeFilter === FILTER_ALL ? "default" : "outline"}
                size="xs"
                onClick={() => setActiveFilter(FILTER_ALL)}
              >
                All
              </Button>
              {visibleTags.map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant={activeFilter === tag ? "default" : "outline"}
                  size="xs"
                  onClick={() => setActiveFilter(tag)}
                >
                  {tag}
                </Button>
              ))}
              {moreTags.length > 0 && (
                <Select
                  value={moreTags.includes(activeFilter) ? activeFilter : ""}
                  onValueChange={(v) => v != null && setActiveFilter(v)}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="More tags" />
                  </SelectTrigger>
                  <SelectContent>
                    {moreTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2 pb-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-transparent transition-colors hover:border-border"
                    onClick={() => {
                      onSelect(template);
                      onOpenChange(false);
                    }}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-lg">
                      <Image
                        src={template.src}
                        alt={template.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <p className="mt-1.5 px-0.5 text-xs font-medium leading-snug line-clamp-2 text-foreground">
                      {template.title}
                    </p>
                  </div>
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MagnifyingGlass className="size-8 mb-2" />
                  <p className="text-sm font-medium">No templates found</p>
                  <p className="text-xs mt-1">
                    Try adjusting your search or add templates via Manage
                    Library
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="import"
            className="flex-1 flex flex-col overflow-hidden mt-0"
          >
            <Tabs
              defaultValue="import-file"
              className="flex flex-col flex-1 overflow-hidden"
              onValueChange={(v) =>
                setActiveImportTab(v as typeof activeImportTab)
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4 pb-3">
                <TabsList>
                  <TabsTrigger value="import-file">
                    <YoutubeLogo className="size-4" weight="fill" />
                    Bulk URLs
                  </TabsTrigger>
                  <TabsTrigger value="import-yt">
                    <YoutubeLogo className="size-4" weight="fill" />
                    Single URL
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={
                      activeImportTab === "import-yt"
                        ? handleSaveChannel
                        : handleSaveBulk
                    }
                    disabled={
                      activeImportTab === "import-yt"
                        ? channelPreviews.length === 0
                        : bulkPreviews.length === 0
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </div>

              <TabsContent
                value="import-file"
                className="flex-1 flex flex-col overflow-hidden px-6 pb-6 mt-0"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  BULK YOUTUBE IMPORTS
                </p>
                <textarea
                  rows={8}
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder={
                    "Paste one YouTube URL per line, e.g.:\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/watch?v=jNQXAC9IVRw\nhttps://youtu.be/9bZkp7q19f0"
                  }
                  className="w-full flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 mb-4"
                />
                {bulkPreviews.length > 0 && (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {bulkPreviews.map((item, i) => (
                      <div
                        key={i}
                        className="relative shrink-0 w-40 sm:w-44 aspect-video overflow-hidden rounded-lg border"
                      >
                        <Image
                          src={item.thumbnail}
                          alt={`Preview ${i + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                )}
                {bulkPreviews.length === 0 && bulkUrls.trim().length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    No valid YouTube URLs detected. Paste one URL per line.
                  </p>
                )}
              </TabsContent>

              <TabsContent
                value="import-yt"
                className="flex-1 flex flex-col overflow-hidden px-6 pb-6 mt-0"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Import from YouTube
                </p>
                <div className="mb-4">
                  <Input
                    placeholder="Paste a YouTube video URL, e.g. https://youtu.be/dQw4w9WgXcQ"
                    value={channelUrl}
                    onChange={(e) => setChannelUrl(e.target.value)}
                  />
                </div>
                {channelPreviews.length > 0 && (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {channelPreviews.map((item, i) => (
                      <div
                        key={i}
                        className="relative shrink-0 w-40 sm:w-44 aspect-video overflow-hidden rounded-lg border"
                      >
                        <Image
                          src={item.thumbnail}
                          alt={`Preview ${i + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
