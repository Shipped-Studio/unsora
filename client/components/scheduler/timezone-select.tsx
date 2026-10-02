"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CaretDown as ChevronDown,
  Globe,
  MagnifyingGlass as Search,
  Check,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  formatTimezoneLabel,
  formatTimezoneName,
  getAllTimezones,
  getBrowserTimezone,
  getTimezoneOffsetLabel,
} from "@/lib/timezone";

interface TimezoneSelectProps {
  value: string;
  onValueChange: (timezone: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function TimezoneSelect({
  value,
  onValueChange,
  disabled,
  className,
  placeholder = "Select timezone",
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allTimezones = useMemo(() => getAllTimezones(), []);
  const browserTz = useMemo(() => getBrowserTimezone(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTimezones;
    return allTimezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [allTimezones, query]);

  const triggerLabel = value ? formatTimezoneLabel(value) : placeholder;

  const handleSelect = (tz: string) => {
    onValueChange(tz);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between gap-2 text-sm font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) p-0 gap-0 overflow-hidden"
        align="start"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search timezones…"
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent"
            autoFocus
          />
        </div>

        {value !== browserTz && (
          <button
            type="button"
            onClick={() => handleSelect(browserTz)}
            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
          >
            <span>
              Use my local timezone:{" "}
              <span className="font-medium text-foreground">
                {formatTimezoneName(browserTz)}
              </span>
            </span>
            <span className="tabular-nums">{getTimezoneOffsetLabel(browserTz)}</span>
          </button>
        )}

        <ScrollArea className="max-h-72">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No timezones match &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((tz) => {
                const isSelected = tz === value;
                return (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => handleSelect(tz)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                      isSelected && "bg-accent",
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{formatTimezoneName(tz)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {getTimezoneOffsetLabel(tz)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
