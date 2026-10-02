"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUp,
  Users,
  ListChecks,
  ImagesSquare,
  ChartBar,
  Sparkle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

const TABS: { label: string; href: string; icon: ComponentType<IconProps>; exact?: boolean }[] = [
  { label: "Overview", href: "/admin", icon: ChartLineUp, exact: true },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Tasks", href: "/admin/tasks", icon: ListChecks },
  { label: "Content", href: "/admin/content", icon: ImagesSquare },
  { label: "Skills", href: "/admin/skills", icon: Sparkle },
  { label: "Analytics", href: "/admin/analytics", icon: ChartBar },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <tab.icon weight={active ? "fill" : "regular"} className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
