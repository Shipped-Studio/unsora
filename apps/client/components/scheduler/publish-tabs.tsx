"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Calendar", href: "/scheduler/calendar" },
  { label: "Queue", href: "/scheduler/queue" },
  { label: "Posts", href: "/scheduler/posts" },
];

/** Switches between the three views of your schedule, which share one rail item. */
export function PublishTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Schedule views"
      className="hidden h-10 items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 sm:flex"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-full items-center rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
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
