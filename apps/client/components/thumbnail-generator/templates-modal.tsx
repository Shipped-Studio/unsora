"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { MagnifyingGlass } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ThumbnailTemplate } from "@/lib/thumbmaker-types";
import { getYoutubeThumbnail, type ContextItem } from "./add-context-modal";
import { TagFilter, presetTemplates, tagOptions } from "./template-filters";

interface TemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: ThumbnailTemplate) => void;
  /** Uses a YouTube video's thumbnail as the template. */
  onImportContext?: (items: ContextItem[]) => void;
}

export function TemplatesModal({
  open,
  onOpenChange,
  onSelect,
  onImportContext,
}: TemplatesModalProps) {
  const [tag, setTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const youtubeThumbnail = youtubeUrl.trim()
    ? getYoutubeThumbnail(youtubeUrl.trim())
    : null;

  const filtered = useMemo(
    () =>
      presetTemplates.filter((t) => {
        const matchesTag = !tag || t.tags.includes(tag);
        const matchesSearch =
          !search || t.title.toLowerCase().includes(search.toLowerCase());
        return matchesTag && matchesSearch;
      }),
    [tag, search],
  );

  const applyYoutube = () => {
    if (!onImportContext || !youtubeThumbnail) return;
    onImportContext([
      {
        id: crypto.randomUUID(),
        type: "youtube",
        label: youtubeUrl.trim(),
        thumbnail: youtubeThumbnail,
      },
    ]);
    setYoutubeUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            The thumbnail follows the template&apos;s layout and style.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="presets" className="flex min-h-0 flex-1 flex-col gap-4">
          <TabsList>
            <TabsTrigger value="presets">Presets</TabsTrigger>
            {onImportContext && (
              <TabsTrigger value="youtube">From YouTube</TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="presets"
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <Input
              placeholder="Search templates"
              aria-label="Search templates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <TagFilter tags={tagOptions} value={tag} onChange={setTag} />

            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
              {filtered.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filtered.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        onSelect(template);
                        onOpenChange(false);
                      }}
                      className="group rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="relative block aspect-video overflow-hidden rounded-xl bg-muted transition-colors group-hover:border-foreground/30">
                        <Image
                          src={template.src}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 200px, 45vw"
                          unoptimized
                          className="object-cover"
                        />
                      </span>
                      <span className="mt-1.5 line-clamp-2 block text-xs font-medium">
                        {template.title}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 py-12 text-center text-muted-foreground">
                  <MagnifyingGlass className="mb-1 size-6" />
                  <p className="text-sm font-medium text-foreground">
                    No templates found
                  </p>
                  <p className="text-xs">Try a different search or tag.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {onImportContext && (
            <TabsContent value="youtube" className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="template-youtube-url">YouTube video link</Label>
                <Input
                  id="template-youtube-url"
                  placeholder="https://youtu.be/..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyYoutube();
                  }}
                  aria-invalid={!!youtubeUrl.trim() && !youtubeThumbnail}
                />
                {youtubeUrl.trim() && !youtubeThumbnail && (
                  <p className="text-xs text-destructive">
                    That isn&apos;t a YouTube video link.
                  </p>
                )}
              </div>
              {youtubeThumbnail && (
                <div className="relative aspect-video w-48 overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={youtubeThumbnail}
                    alt="Thumbnail of the linked video"
                    fill
                    sizes="192px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={applyYoutube} disabled={!youtubeThumbnail}>
                  Use as template
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
