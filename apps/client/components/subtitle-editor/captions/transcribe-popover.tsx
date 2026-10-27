"use client";

import { useId, useState } from "react";
import { Waveform } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { LANGUAGE_ITEMS } from "@/components/subtitle-editor/captions/languages";

export interface TranscriptionOptions {
  language: string;
}

/**
 * The Transcribe button and its language picker. Language lives here; it
 * only matters when transcribing. Lines are split at sentence ends, commas
 * and pauses, so there's no words-per-line setting.
 */
export function TranscribePopover({
  language,
  hasLines,
  isStarting,
  onStart,
  variant,
}: {
  language: string;
  /** Re-transcribing replaces existing lines, so the button warns. */
  hasLines: boolean;
  isStarting: boolean;
  onStart: (options: TranscriptionOptions) => void;
  variant: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState(language);
  const label = hasLines ? "Transcribe again" : "Transcribe";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraftLanguage(language);
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button variant={variant} size="sm" disabled={isStarting} />}>
        {isStarting ? <Spinner /> : <Waveform />}
        {isStarting ? "Starting…" : label}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
          <PopoverDescription>
            {hasLines
              ? "The new transcript replaces every line, including your edits."
              : "Creates timed subtitle lines from the audio."}
          </PopoverDescription>
        </PopoverHeader>
        <LabelledSelect
          label="Audio language"
          value={draftLanguage}
          items={LANGUAGE_ITEMS}
          onChange={setDraftLanguage}
          className="w-full"
        />
        <Button
          variant={hasLines ? "destructive" : "default"}
          className="w-full"
          onClick={() => {
            setOpen(false);
            onStart({ language: draftLanguage });
          }}
        >
          <Waveform />
          {label}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function LabelledSelect({
  label,
  value,
  items,
  onChange,
  className,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const labelId = useId();
  return (
    // flex gap, not space-y: Base UI renders a hidden <input> after the
    // trigger, so space-y would add a bottom margin to the trigger.
    <div className="flex flex-col gap-2">
      <span id={labelId} className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <SelectTrigger aria-labelledby={labelId} className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
