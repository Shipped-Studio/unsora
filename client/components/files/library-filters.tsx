"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIBRARY_KIND_LABELS,
  LIBRARY_KINDS,
  LIBRARY_KINDS_BY_MEDIA,
  LIBRARY_SOURCE_LABELS,
  type LibraryFilterMediaType,
  type LibraryKind,
  type LibrarySource,
} from "@/hooks/use-library";

export type LibraryTab = "all" | LibraryFilterMediaType;

export const LIBRARY_TABS: { value: LibraryTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "image", label: "Images" },
  { value: "audio", label: "Audio" },
];

export function isLibraryTab(value: unknown): value is LibraryTab {
  return LIBRARY_TABS.some((t) => t.value === value);
}

export type LibrarySourceFilter = "all" | LibrarySource;

export function isLibrarySourceFilter(
  value: unknown,
): value is LibrarySourceFilter {
  return value === "all" || value === "web" || value === "api";
}

/** Kinds that can appear under a tab. */
export function kindsForTab(tab: LibraryTab): LibraryKind[] {
  return tab === "all" ? LIBRARY_KINDS : LIBRARY_KINDS_BY_MEDIA[tab];
}

/** Tab triggers. Render inside a `<Tabs>`. */
export function LibraryTabsList({
  tabs = LIBRARY_TABS,
  className,
}: {
  tabs?: { value: LibraryTab; label: string }[];
  className?: string;
}) {
  return (
    <TabsList className={className}>
      {tabs.map((tab) => (
        <TabsTrigger key={tab.value} value={tab.value} className="px-3">
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export function LibraryKindSelect({
  tab,
  value,
  onValueChange,
}: {
  tab: LibraryTab;
  value: LibraryKind | "all";
  onValueChange: (value: LibraryKind | "all") => void;
}) {
  const kinds = kindsForTab(tab);
  const items: Record<string, string> = { all: "All types" };
  for (const kind of kinds) items[kind] = LIBRARY_KIND_LABELS[kind];

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onValueChange((next as LibraryKind | null) ?? "all")}
    >
      <SelectTrigger size="sm" className="min-w-36" aria-label="Type">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All types</SelectItem>
        {kinds.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {LIBRARY_KIND_LABELS[kind]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SOURCE_ITEMS: Record<LibrarySourceFilter, string> = {
  all: "All sources",
  web: LIBRARY_SOURCE_LABELS.web,
  api: LIBRARY_SOURCE_LABELS.api,
};

export function LibrarySourceSelect({
  value,
  onValueChange,
}: {
  value: LibrarySourceFilter;
  onValueChange: (value: LibrarySourceFilter) => void;
}) {
  return (
    <Select
      items={SOURCE_ITEMS}
      value={value}
      onValueChange={(next) =>
        onValueChange(isLibrarySourceFilter(next) ? next : "all")
      }
    >
      <SelectTrigger size="sm" className="min-w-36" aria-label="Source">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(SOURCE_ITEMS) as LibrarySourceFilter[]).map((key) => (
          <SelectItem key={key} value={key}>
            {SOURCE_ITEMS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
