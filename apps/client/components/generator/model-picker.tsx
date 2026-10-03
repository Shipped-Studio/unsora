"use client";

import { useState } from "react";
import Image from "next/image";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ModelPickerItem {
  key: string;
  label: string;
  /** Line under the label: the provider name, or a short description. */
  sublabel: string;
  /** Native tooltip with the full description or price. */
  title?: string;
  /** Logo image path under /public; takes precedence over `icon`. */
  iconSrc?: string;
  icon?: ComponentType<IconProps>;
}

interface ModelPickerProps {
  /** Accessible name for the trigger, e.g. "Model" or "Mode". */
  label: string;
  items: ModelPickerItem[];
  activeKey: string;
  disabled?: boolean;
  columns?: 2 | 3;
  onSelect: (key: string) => void;
}

function ItemIcon({ item, size }: { item: ModelPickerItem; size: "sm" | "lg" }) {
  const className = size === "sm" ? "size-4 shrink-0" : "size-5 shrink-0";
  if (item.iconSrc) {
    return (
      <Image
        src={item.iconSrc}
        alt=""
        width={size === "sm" ? 16 : 20}
        height={size === "sm" ? 16 : 20}
        className={className}
        unoptimized
      />
    );
  }
  if (item.icon) {
    return <item.icon className={cn(className, "text-muted-foreground")} />;
  }
  return null;
}

/** Composer toolbar trigger plus a popover grid for picking a model or mode. */
export function ModelPicker({
  label,
  items,
  activeKey,
  disabled = false,
  columns = 3,
  onSelect,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const active = items.find((i) => i.key === activeKey) ?? items[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`${label}: ${active.label}`}
            className="font-medium"
          />
        }
      >
        <ItemIcon item={active} size="sm" />
        <span className="truncate">{active.label}</span>
        <CaretDown className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "max-w-[calc(100vw-2rem)] gap-2 p-2",
          columns === 3 ? "w-[640px]" : "w-[480px]",
        )}
        side="top"
        align="start"
        sideOffset={8}
      >
        <p className="px-2 pt-1 text-xs text-muted-foreground">{label}</p>
        <div
          role="group"
          aria-label={label}
          className={cn(
            "grid max-h-[min(60svh,32rem)] grid-cols-1 gap-1 overflow-y-auto",
            columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {items.map((item) => {
            const isActive = item.key === active.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={isActive}
                title={item.title}
                onClick={() => {
                  onSelect(item.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <ItemIcon item={item} size="lg" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.sublabel}
                  </span>
                </span>
                {isActive && (
                  <Check className="size-4 shrink-0 text-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
