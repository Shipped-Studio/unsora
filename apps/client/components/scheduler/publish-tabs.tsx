"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Calendar", href: "/scheduler/calendar" },
  { label: "Queue", href: "/scheduler/queue" },
  { label: "Posts", href: "/scheduler/posts" },
];

/**
 * Switches between the three views of your schedule, which share one rail item.
 * `header` sits in the page header from sm up; `page` is the full-width row
 * phones get at the top of the page body instead.
 */
export function PublishTabs({ placement = "header" }: { placement?: "header" | "page" }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Schedule views"
      className={cn(
        "h-9 items-center rounded-lg bg-muted p-1",
        placement === "header" ? "hidden sm:flex" : "mb-4 flex w-full sm:hidden",
      )}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-full flex-1 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
