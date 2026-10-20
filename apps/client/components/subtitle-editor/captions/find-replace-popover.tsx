"use client";

import { useId, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Find and replace across the transcript. The search text is owned by the
 * parent, which highlights the matching words in the caption list.
 */
export function FindReplacePopover({
  find,
  onFindChange,
  matchCount,
  onReplaceAll,
}: {
  find: string;
  onFindChange: (find: string) => void;
  matchCount: number;
  onReplaceAll: (replacement: string) => void;
}) {
  const findId = useId();
  const replaceId = useId();
  const [open, setOpen] = useState(false);
  const [replacement, setReplacement] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing clears the search, and with it the highlighted matches.
        if (!next) onFindChange("");
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <MagnifyingGlass />
        Find and replace
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Find and replace</PopoverTitle>
          <PopoverDescription>
            Replaces a word or phrase across the transcript.
          </PopoverDescription>
        </PopoverHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!matchCount) return;
            onReplaceAll(replacement);
            setReplacement("");
            setOpen(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={findId}>Find</Label>
            <Input
              id={findId}
              autoFocus
              value={find}
              onChange={(event) => onFindChange(event.target.value)}
            />
            {find.trim() ? (
              <p className="text-xs text-muted-foreground">
                {matchCount} {matchCount === 1 ? "match" : "matches"}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={replaceId}>Replace with</Label>
            <Input
              id={replaceId}
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!matchCount}>
            Replace all
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
