"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import thumbnailTemplatesJson from "@/constant/thumbnail-templates.json";
import {
  jsonTemplateToThumbnailTemplate,
  type ThumbnailTemplateJson,
} from "@/lib/thumbmaker-template-map";

const presetTemplates = (
  thumbnailTemplatesJson as ThumbnailTemplateJson[]
).map(jsonTemplateToThumbnailTemplate);

const FILTER_ALL = "All";
const VISIBLE_TAG_COUNT = 6;

export function ManageTemplatesPage() {
  const [activeFilter, setActiveFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("All Creators");

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

  const creators = useMemo(() => {
    const names = new Set<string>();
    for (const t of presetTemplates) {
      if (t.creator?.trim()) names.add(t.creator);
    }
    return ["All Creators", ...[...names].sort()];
  }, []);

  const filteredTemplates = presetTemplates.filter((t) => {
    const matchesTag =
      activeFilter === FILTER_ALL ? true : t.tags.includes(activeFilter);
    const matchesSearch =
      !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchesCreator =
      creatorFilter === "All Creators" || t.creator === creatorFilter;
    return matchesTag && matchesSearch && matchesCreator;
  });

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Thumbnail Templates</h1>
            <p className="text-sm text-muted-foreground">
              Browse preset templates from the library.
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">Tags</span>
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

          <div className="mt-2 flex w-full items-center gap-3 sm:ml-auto sm:mt-0 sm:w-auto">
            <Select
              value={creatorFilter}
              onValueChange={(v) => v != null && setCreatorFilter(v)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Creator" />
              </SelectTrigger>
              <SelectContent>
                {creators.map((creator) => (
                  <SelectItem key={creator} value={creator}>
                    {creator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="group cursor-pointer">
              <div className="relative aspect-video overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
                <Image
                  src={template.src}
                  alt={template.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="mt-2 px-0.5">
                <p className="line-clamp-2 text-sm font-medium leading-snug">
                  {template.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {template.creator}
                  </span>
                  {template.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MagnifyingGlass className="mb-3 size-10" />
            <p className="text-sm font-medium">No templates found</p>
            <p className="text-xs">Try adjusting your filters or search</p>
          </div>
        )}
      </div>
    </div>
  );
}
