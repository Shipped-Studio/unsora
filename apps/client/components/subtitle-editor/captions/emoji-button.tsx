"use client";

import { useState } from "react";
import { SmileyWink } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ROW_ICON_CLASS } from "@/components/subtitle-editor/captions/shared";
import { EMOJI_GROUPS } from "@/components/subtitle-editor/emoji-data";
import { cn } from "@/lib/utils";

/** Add emoji, or Remove emoji when the line has one. */
export function EmojiButton({
  emoji,
  lineNumber,
  onChange,
}: {
  emoji?: string;
  lineNumber: number;
  onChange: (emoji: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  if (emoji) {
    return (
      <button
        type="button"
        aria-label={`Remove emoji ${emoji} from line ${lineNumber}`}
        title="Remove emoji"
        onClick={() => onChange(undefined)}
        className={cn(ROW_ICON_CLASS, "text-base")}
      >
        {emoji}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Add an emoji to line ${lineNumber}`}
            title="Add emoji"
            className={ROW_ICON_CLASS}
          />
        }
      >
        <SmileyWink />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 gap-3">
        <EmojiPicker
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The emoji search and grid. It's mounted only while the popover is open,
 * so closed rows skip the filtering and the search starts empty each time.
 */
function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = EMOJI_GROUPS.map((group) => ({
    ...group,
    emojis: needle
      ? group.emojis.filter(([, keywords]) => keywords.includes(needle))
      : group.emojis,
  })).filter((group) => group.emojis.length > 0);

  return (
    <>
      <Input
        type="search"
        autoFocus
        aria-label="Search emoji"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search emoji"
      />
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No emoji match &ldquo;{query}&rdquo;.
          </p>
        ) : null}
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emojis.map(([char, keywords]) => (
                <button
                  key={char}
                  type="button"
                  title={keywords}
                  aria-label={keywords.split(" ")[0]}
                  onClick={() => onPick(char)}
                  className="flex aspect-square items-center justify-center rounded-md text-xl outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
