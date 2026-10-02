"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import thumbnailTemplatesJson from "@/constant/thumbnail-templates.json";
import {
  jsonTemplateToThumbnailTemplate,
  type ThumbnailTemplateJson,
} from "@/lib/thumbmaker-template-map";

export const presetTemplates = (
  thumbnailTemplatesJson as ThumbnailTemplateJson[]
).map(jsonTemplateToThumbnailTemplate);

/** Tags ordered by how many presets use them. */
export const tagOptions: string[] = (() => {
  const counts = new Map<string, number>();
  for (const t of presetTemplates) {
    for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
})();

const VISIBLE_TAG_COUNT = 6;

/** "All", the most used tags as buttons, and the rest in a select. */
export function TagFilter({
  tags,
  value,
  onChange,
}: {
  tags: string[];
  value: string | null;
  onChange: (tag: string | null) => void;
}) {
  const visible = tags.slice(0, VISIBLE_TAG_COUNT);
  const more = tags.slice(VISIBLE_TAG_COUNT);
  const moreSelected = value !== null && more.includes(value);

  return (
    <div role="group" aria-label="Filter by tag" className="flex flex-wrap items-center gap-1">
      <Button
        variant={value === null ? "secondary" : "ghost"}
        size="xs"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        All
      </Button>
      {visible.map((tag) => (
        <Button
          key={tag}
          variant={value === tag ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={value === tag}
          onClick={() => onChange(tag)}
        >
          {tag}
        </Button>
      ))}
      {more.length > 0 && (
        <Select
          value={moreSelected ? value : ""}
          onValueChange={(v) => v && onChange(v)}
        >
          <SelectTrigger
            size="xs"
            variant={moreSelected ? "muted" : "ghost"}
            aria-label="More tags"
          >
            <span>{moreSelected ? value : "More tags"}</span>
          </SelectTrigger>
          <SelectContent>
            {more.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
