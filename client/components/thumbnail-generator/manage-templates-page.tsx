"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { TagFilter, presetTemplates, tagOptions } from "./template-filters";

const ALL_CREATORS = "all";

const creators = [
  ...new Set(presetTemplates.map((t) => t.creator?.trim()).filter(Boolean)),
].sort() as string[];

/** Browse the preset thumbnail templates offered in the Thumbnails composer. */
export function ManageTemplatesPage() {
  const [tag, setTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creator, setCreator] = useState(ALL_CREATORS);

  const filtered = useMemo(
    () =>
      presetTemplates.filter((t) => {
        const matchesTag = !tag || t.tags.includes(tag);
        const matchesSearch =
          !search || t.title.toLowerCase().includes(search.toLowerCase());
        const matchesCreator =
          creator === ALL_CREATORS || t.creator === creator;
        return matchesTag && matchesSearch && matchesCreator;
      }),
    [tag, search, creator],
  );

  const hasFilters = tag !== null || !!search || creator !== ALL_CREATORS;

  return (
    <>
      <PageHeader
        title="Templates"
        parents={[{ label: "Thumbnails", href: "/thumbnail-generator" }]}
      />
      <PageBody className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <TagFilter tags={tagOptions} value={tag} onChange={setTag} />
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <Select
              value={creator}
              onValueChange={(v) => v && setCreator(v)}
            >
              <SelectTrigger size="sm" aria-label="Creator">
                <span>{creator === ALL_CREATORS ? "All creators" : creator}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CREATORS}>All creators</SelectItem>
                {creators.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search templates"
              aria-label="Search templates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 sm:w-56"
            />
          </div>
        </div>

        {filtered.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((template) => (
              <li key={template.id} className="min-w-0">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={template.src}
                    alt={template.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium">
                  {template.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {template.creator && (
                    <span className="text-xs text-muted-foreground">
                      {template.creator}
                    </span>
                  )}
                  {template.tags.slice(0, 2).map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MagnifyingGlass}
            title="No templates found"
            description="Try a different search, tag or creator."
            action={
              hasFilters
                ? {
                    label: "Clear filters",
                    onClick: () => {
                      setTag(null);
                      setSearch("");
                      setCreator(ALL_CREATORS);
                    },
                  }
                : undefined
            }
          />
        )}
      </PageBody>
    </>
  );
}
