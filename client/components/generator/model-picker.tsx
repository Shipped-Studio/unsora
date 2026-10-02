"use client";

import { useState } from "react";
import Image from "next/image";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react";
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
  /** Small line under the label (provider name or short description). */
  sublabel: string;
  /** Hover tooltip (full description, price hint). */
  title?: string;
  badge?: "Popular" | "New";
  /** Logo image path under /public; takes precedence over `icon`. */
  iconSrc?: string;
  icon?: ComponentType<IconProps>;
}

interface ModelPickerProps {
  heading: string;
  headingIcon: ComponentType<IconProps>;
  items: ModelPickerItem[];
  activeKey: string;
  disabled?: boolean;
  columns?: 2 | 3;
  onSelect: (key: string) => void;
}

function ItemIcon({
  item,
  size,
}: {
  item: ModelPickerItem;
  size: "sm" | "lg";
}) {
  const px = size === "sm" ? 16 : 20;
  if (item.iconSrc) {
    return (
      <Image
        src={item.iconSrc}
        alt=""
        width={px}
        height={px}
        className={size === "sm" ? "size-4 shrink-0" : "size-5"}
        unoptimized
      />
    );
  }
  if (item.icon) {
    return (
      <item.icon
        className={cn(
          "shrink-0 text-muted-foreground",
          size === "sm" ? "size-4" : "size-5",
        )}
        weight="fill"
      />
    );
  }
  return null;
}

/** Toolbar trigger + popover panel for picking a model or generation mode. */
export function ModelPicker({
  heading,
  headingIcon: HeadingIcon,
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
      <PopoverTrigger>
        <Button
          variant="ghost"
          disabled={disabled}
          className="h-8 text-xs gap-1.5 px-2 font-medium"
        >
          <ItemIcon item={active} size="sm" />
          <span className="truncate">{active.label}</span>
          <CaretDown className="size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "max-w-[calc(100vw-2rem)] rounded-2xl p-4",
          columns === 3 ? "w-[640px]" : "w-[480px]",
        )}
        side="top"
        align="start"
        sideOffset={12}
      >
        
        <div
          className={cn(
            "grid grid-cols-1 gap-1",
            columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {items.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  setOpen(false);
                }}
                title={item.title}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    item.iconSrc ? "bg-card" : "bg-muted/50",
                  )}
                >
                  <ItemIcon item={item} size="lg" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight">
                    {item.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs text-muted-foreground">
                      {item.sublabel}
                    </span>
                    {item.badge && (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide",
                          item.badge === "Popular"
                            ? "bg-warning/15 text-warning"
                            : "bg-success/15 text-success",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
