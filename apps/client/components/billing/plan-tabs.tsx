"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/*
 * The switch between what's on sale (scheduler, monthly credits, packs), the
 * same on Billing, the pricing dialog and onboarding: a white pill with the
 * chosen side in solid ink. The default muted tabs disappear on tinted
 * backgrounds like onboarding's.
 */

const TRIGGER =
  "h-9 rounded-full px-3 text-sm text-foreground/70 data-active:bg-foreground! data-active:text-background! sm:h-10 sm:px-5 sm:text-[15px]";

export function PlanTabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as T)} className={className}>
      <TabsList className="h-11 max-w-full overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-card p-1 shadow-sm ring-1 ring-border sm:h-12">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className={cn(TRIGGER)}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
