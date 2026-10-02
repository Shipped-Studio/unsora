"use client";

import { useRef, useState } from "react";
import { FolderOpen, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Drop zone with explicit Upload and Library buttons. Accepts files by drag,
 * paste or the file picker.
 */
export function MediaDrop({
  kind,
  multiple,
  onFiles,
  onOpenLibrary,
  title,
  hint,
  compact,
}: {
  kind: "video" | "image";
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  onOpenLibrary: () => void;
  title: string;
  hint: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = kind === "video" ? "video/*" : "image/*";

  const take = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((file) =>
      file.type.startsWith(kind === "video" ? "video/" : "image/"),
    );
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files);
      }}
      onPaste={(event) => take(Array.from(event.clipboardData.files))}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 text-center transition-colors",
        compact ? "py-6" : "py-10",
        dragging && "border-foreground/40 bg-accent",
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {dragging ? "Drop to upload" : title}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimple />
          Upload
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpenLibrary}>
          <FolderOpen />
          Choose from Library
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
