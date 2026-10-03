"use client";

import { createContext, useContext, useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { cn } from "@/lib/utils";
import { filesFromClipboard, type Attachment, type UploadField } from "./attachments";
import { MediaSlots } from "./media-slots";

/**
 * Building blocks for the composer every Create tool docks at the bottom of
 * its page: a card with a settings toolbar, the prompt, and a footer with
 * media and the Generate button.
 */

interface ComposerContextValue {
  dragging: boolean;
  onFiles?: (files: File[]) => void;
}

const ComposerContext = createContext<ComposerContextValue>({
  dragging: false,
});

/** Sticky dock wrapper. Files dropped anywhere on it go to `onFiles`. */
export function ComposerDock({
  onFiles,
  children,
}: {
  /** Receives dropped and pasted files. Omit for tools without media. */
  onFiles?: (files: File[]) => void;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={BOTTOM_PROMPT_DOCK_CLASS}
      onDragOver={(e) => {
        if (!onFiles || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (!onFiles) return;
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) {
          onFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <ComposerContext.Provider value={{ dragging, onFiles }}>
        <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2">
          {children}
        </div>
      </ComposerContext.Provider>
    </div>
  );
}

/** The composer surface. Pasted files go to the dock's `onFiles`. */
export function ComposerCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { dragging, onFiles } = useContext(ComposerContext);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-lg transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        dragging && "border-ring ring-3 ring-ring/50",
        className,
      )}
      onPaste={(e) => {
        if (!onFiles) return;
        const files = filesFromClipboard(e);
        if (files.length === 0) return;
        e.preventDefault();
        onFiles(files);
      }}
    >
      {dragging && (
        <p className="px-4 pt-3 text-xs font-medium text-foreground">
          Drop files to attach them
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * Settings row at the top of the card. One horizontally scrolling row on
 * phones (fading out at the right edge), wrapping from sm up.
 */
export function ComposerToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b px-2 py-1.5 max-sm:[mask-image:linear-gradient(to_right,black_85%,transparent)] max-sm:pr-8 sm:flex-wrap sm:overflow-x-visible [&>*]:shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ComposerDivider() {
  return <div aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />;
}

/**
 * Borderless prompt text inside a ComposerCard. The card draws the focus ring,
 * so the field drops its own outline. text-base on phones avoids iOS zoom.
 */
export const COMPOSER_PROMPT_CLASS =
  "field-sizing-content block max-h-52 min-h-20 w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50 md:text-sm";

/** Auto-growing prompt field. Cmd/Ctrl+Enter submits. */
export function ComposerPrompt({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** Accessible name, e.g. "Video prompt". */
  label: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      maxLength={maxLength}
      rows={3}
      className={COMPOSER_PROMPT_CLASS}
    />
  );
}

export function ComposerFooter({
  start,
  end,
}: {
  start?: React.ReactNode;
  end: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      <div className="flex min-w-0 items-center gap-1.5">{start}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div>
    </div>
  );
}

/** "Uploading 2 files", shown beside the Generate button. */
export function UploadingNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="hidden text-xs text-muted-foreground sm:inline">
      Uploading {count} {count === 1 ? "file" : "files"}
    </span>
  );
}

/**
 * The composer's media button: a popover with the tool's upload slots, the
 * library, and a device upload that routes files through `onFiles`.
 */
export function AddMediaButton({
  fields,
  attachments,
  onPick,
  onRemove,
  onFiles,
  showArrows,
  disabled,
  label = "Add media",
}: {
  fields: UploadField[];
  attachments: Attachment[];
  onPick: (field: UploadField) => void;
  onRemove: (id: string) => void;
  onFiles: (files: File[]) => void;
  showArrows?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = Array.from(new Set(fields.map((f) => f.accept))).join(",");
  const count = attachments.filter((a) => a.status !== "error").length;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label={count > 0 ? `${label}, ${count} attached` : label}
            />
          }
        >
          <Plus />
          <span className="hidden sm:inline">{label}</span>
          {count > 0 && (
            <span className="tabular-nums text-muted-foreground">{count}</span>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="w-auto gap-0 p-0"
          side="top"
          align="start"
          sideOffset={8}
        >
          <MediaSlots
            fields={fields}
            attachments={attachments}
            showArrows={showArrows}
            onPick={(field) => {
              setOpen(false);
              onPick(field);
            }}
            onRemove={onRemove}
            onUpload={() => inputRef.current?.click()}
          />
        </PopoverContent>
      </Popover>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) {
            setOpen(false);
            onFiles(files);
          }
        }}
      />
    </>
  );
}
