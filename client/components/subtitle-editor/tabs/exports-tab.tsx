"use client";

import {
  ExportCard,
  ExportsEmptyState,
} from "@/components/subtitle-editor/export-card";
import type { VideoExportItem } from "@/remotion/types";

interface ExportsTabProps {
  exports: VideoExportItem[];
  /** Request deletion — the parent shows a confirmation dialog. */
  onDelete: (id: string) => void;
}

export function ExportsTab({ exports, onDelete }: ExportsTabProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        Exported Videos
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          ({exports.length})
        </span>
      </h3>
      {exports.length === 0 ? (
        <ExportsEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {exports.map((exp) => (
            <ExportCard key={exp.id} item={exp} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
