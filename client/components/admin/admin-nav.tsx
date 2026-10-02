"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS: { label: string; href: string; exact?: boolean }[] = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Users", href: "/admin/users" },
  { label: "Tasks", href: "/admin/tasks" },
  { label: "Content", href: "/admin/content" },
  { label: "Skills", href: "/admin/skills" },
  { label: "Analytics", href: "/admin/analytics" },
];

/** Section links shown at the top of every admin page. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin sections"
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-2 no-scrollbar"
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
              buttonVariants({ variant: "ghost", size: "sm" }),
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
