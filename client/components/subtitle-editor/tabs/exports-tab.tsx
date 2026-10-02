"use client";

import Link from "next/link";
import { FilmSlate } from "@phosphor-icons/react";
import { EmptyState } from "@/components/shared/states";
import { EditorSection } from "@/components/subtitle-editor/editor-fields";
import { ExportCard } from "@/components/subtitle-editor/export-card";
import type { VideoExportItem } from "@/remotion/types";

export function ExportsTab({
  exports,
  onDelete,
}: {
  exports: VideoExportItem[];
  onDelete: (item: VideoExportItem) => void;
}) {
  if (exports.length === 0) {
    return (
      <EmptyState
        icon={FilmSlate}
        title="No exports yet"
        description="Export this project to render the video with its subtitles."
      />
    );
  }

  return (
    <EditorSection
      title="Exports"
      description={`${exports.length} ${exports.length === 1 ? "video" : "videos"} rendered from this project.`}
      actions={
        <Link
          href="/subtitle-editor/exports"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          All exports
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exports.map((item) => (
          <ExportCard key={item.id} item={item} onDelete={onDelete} />
        ))}
      </div>
    </EditorSection>
  );
}
