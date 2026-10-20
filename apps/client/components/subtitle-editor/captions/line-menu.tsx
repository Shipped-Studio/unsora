"use client";

import { useState } from "react";
import { TextAa } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LineSize } from "@/components/subtitle-editor/caption-style";
import { useCaptionsEditor } from "@/components/subtitle-editor/captions/captions-context";
import { ROW_ICON_CLASS } from "@/components/subtitle-editor/captions/shared";
import {
  applyLineToAll,
  resetAllLines,
  resetLine,
  setLine,
} from "@/components/subtitle-editor/chunk-edits";
import {
  ChoiceGroup,
  ChoiceItem,
  SelectField,
  SliderField,
  SwitchRow,
} from "@/components/subtitle-editor/editor-fields";
import { SUBTITLE_PRESETS } from "@/components/subtitle-editor/style-presets";
import { cn } from "@/lib/utils";
import type { SubtitleChunk } from "@/remotion/types";

const LINE_SIZES: { value: LineSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

/** Templates a line can use instead of the project's. */
const LINE_TEMPLATES = SUBTITLE_PRESETS.filter((p) => p.group !== "archived");

/** The Style option meaning "use the project's template". */
const DEFAULT_STYLE = "default";

const STYLE_OPTIONS = [
  { value: DEFAULT_STYLE, label: "Default" },
  ...LINE_TEMPLATES.map((t) => ({ value: t.id, label: t.name })),
];

/** The Caption Line menu: the line's size, position, template and emphasis. */
export function LineMenu({ lineIndex }: { lineIndex: number }) {
  const { chunks, onChunksChange, placement } = useCaptionsEditor();
  const [open, setOpen] = useState(false);
  const line = chunks[lineIndex];
  const hasOwnSettings =
    line.size || line.positionY !== undefined || line.style || line.emphasize;

  const update = (patch: Parameters<typeof setLine>[2]) =>
    onChunksChange(setLine(chunks, lineIndex, patch));

  /** Applies an edit to the whole list, then closes the menu. */
  const finish = (next: SubtitleChunk[]) => {
    onChunksChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Size and position of line ${lineIndex + 1}`}
            className={cn(ROW_ICON_CLASS, hasOwnSettings && "text-[#3F83F8]")}
          />
        }
      >
        <TextAa />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 gap-4">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Size</span>
          <ChoiceGroup
            label="Line size"
            value={line.size ?? "medium"}
            onChange={(size) => update({ size: size === "medium" ? undefined : size })}
            className="grid grid-cols-3"
          >
            {LINE_SIZES.map((size) => (
              <ChoiceItem key={size.value} value={size.value}>
                {size.label}
              </ChoiceItem>
            ))}
          </ChoiceGroup>
        </div>
        <SliderField
          label="Position Y"
          unit="%"
          value={Math.round(line.positionY ?? placement.y)}
          min={0}
          max={100}
          defaultValue={Math.round(placement.y)}
          onChange={(positionY) => update({ positionY })}
        />
        <SelectField
          label="Style"
          options={STYLE_OPTIONS}
          value={line.style?.id ?? DEFAULT_STYLE}
          onChange={(id) => update({ style: LINE_TEMPLATES.find((t) => t.id === id) })}
        />
        <SwitchRow
          label="Emphasize text"
          checked={Boolean(line.emphasize)}
          onCheckedChange={(emphasize) => update({ emphasize: emphasize || undefined })}
        />
        <div className="-mx-1 grid gap-0.5 border-t pt-2">
          <LineAction onClick={() => finish(applyLineToAll(chunks, lineIndex))}>
            Apply to All Lines
          </LineAction>
          <LineAction onClick={() => finish(resetAllLines(chunks))}>
            Reset All Lines
          </LineAction>
          <LineAction onClick={() => finish(resetLine(chunks, lineIndex))}>Reset</LineAction>
          <LineAction
            destructive
            onClick={() => finish(chunks.filter((_, i) => i !== lineIndex))}
          >
            Delete Line
          </LineAction>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LineAction({
  destructive,
  onClick,
  children,
}: {
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted",
        destructive && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}
