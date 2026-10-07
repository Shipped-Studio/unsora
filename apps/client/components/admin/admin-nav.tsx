"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS: { label: string; href: string; exact?: boolean }[] = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Users", href: "/admin/users" },
  { label: "Tasks", href: "/admin/tasks" },
  { label: "Content", href: "/admin/content" },
  { label: "Skills", href: "/admin/skills" },
  { label: "Platforms", href: "/admin/platforms" },
  { label: "Pricing", href: "/admin/pricing" },
  { label: "Analytics", href: "/admin/analytics" },
];

/**
 * Section links shown at the top of every admin page, styled like the
 * `line` Tabs variant. On narrow screens the row scrolls and its right edge
 * fades so the overflow reads as scrollable. The active tab is scrolled into
 * view (clear of the fade, via scroll padding) whenever the route changes.
 */
export function AdminNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  return (
    <div className="border-b">
      <nav
        ref={navRef}
        aria-label="Admin sections"
        className="flex gap-1 overflow-x-auto no-scrollbar max-md:scroll-pr-14 max-md:pr-8 max-md:mask-r-from-85%"
      >
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm first:pl-0 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                "after:absolute after:inset-x-3 after:bottom-0 first:after:left-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:transition-opacity",
                active
                  ? "text-foreground after:opacity-100"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
