"use client";

import { useMemo, useState } from "react";
import { CaretUpDown, Check, GlobeHemisphereWest } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatTimezoneName,
  getAllTimezones,
  getBrowserTimezone,
  getTimezoneOffsetLabel,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

export function TimezoneCombobox({
  value,
  onChange,
  className,
  size = "default",
}: {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const browser = useMemo(() => getBrowserTimezone(), []);
  // Offsets are computed once, when the list is first opened.
  const zones = useMemo(
    () =>
      open
        ? getAllTimezones().map((zone) => ({
            zone,
            label: formatTimezoneName(zone),
            offset: getTimezoneOffsetLabel(zone),
          }))
        : [],
    [open],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            className={cn("justify-between font-normal", className)}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <GlobeHemisphereWest className="text-muted-foreground" />
          <span className="truncate">{formatTimezoneName(value)}</span>
          <span className="text-muted-foreground">{getTimezoneOffsetLabel(value)}</span>
        </span>
        <CaretUpDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search city or region" />
          <CommandList>
            <CommandEmpty>No matching timezone.</CommandEmpty>
            {value !== browser ? (
              <CommandGroup heading="This device">
                <CommandItem
                  value={`device ${browser}`}
                  onSelect={() => {
                    onChange(browser);
                    setOpen(false);
                  }}
                >
                  {formatTimezoneName(browser)}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {getTimezoneOffsetLabel(browser)}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="All timezones">
              {zones.map(({ zone, label, offset }) => (
                <CommandItem
                  key={zone}
                  value={`${label} ${offset}`}
                  onSelect={() => {
                    onChange(zone);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-3.5", zone === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{offset}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
