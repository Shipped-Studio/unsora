"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";
import { List, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAppNav } from "@/components/layout/app-rail";
import { useCommandMenu } from "@/components/layout/command-menu";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { findNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Crumb {
  label: string;
  href: string;
}

interface PageHeaderProps {
  /** Defaults to the matching nav item's label. */
  title?: React.ReactNode;
  /** Defaults to the matching nav item's description. Hidden below lg. */
  description?: React.ReactNode;
  /** Parent pages, rendered as links before the title. */
  parents?: Crumb[];
  actions?: React.ReactNode;
  /** Sub-navigation shown after the title. */
  tabs?: React.ReactNode;
  className?: string;
}

/**
 * The single top bar every signed-in page renders. It carries the sidebar
 * toggle, so there's no floating trigger anywhere else.
 */
export function PageHeader({
  title,
  description,
  parents,
  actions,
  tabs,
  className,
}: PageHeaderProps) {
  const pathname = usePathname();
  const { setOpen } = useAppNav();
  const { setOpen: setSearchOpen } = useCommandMenu();
  const navItem = findNavItem(pathname);
  const resolvedTitle = title ?? navItem?.label;
  // Kept in the API for callers; the header shows the title only.
  void description;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 md:h-18 md:px-6",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Open navigation"
        className="-ml-1 md:hidden"
        onClick={() => setOpen(true)}
      >
        <List className="size-5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-5">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          {parents?.length ? (
          <nav aria-label="Breadcrumb" className="flex shrink-0 items-center gap-1.5">
          {parents.map((crumb) => (
            <span key={crumb.href} className="flex shrink-0 items-center gap-1">
              <Link
                href={crumb.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
              <CaretRight className="size-3 text-muted-foreground" />
            </span>
          ))}
          </nav>
          ) : null}
          <h1 className="truncate font-display text-xl font-bold tracking-[-0.03em] text-foreground md:text-2xl">
            {resolvedTitle}
          </h1>
        </div>
        {tabs}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          title="Search (⌘K)"
          onClick={() => setSearchOpen(true)}
        >
          <MagnifyingGlass className="size-5" />
        </Button>
        <NotificationsMenu />
        {actions}
      </div>
    </header>
  );
}

/** Standard padded content area under a PageHeader. */
export function PageBody({
  className,
  width = "wide",
  ...props
}: React.ComponentProps<"div"> & {
  width?: "narrow" | "default" | "wide" | "full";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8",
        width === "narrow" && "max-w-3xl",
        width === "default" && "max-w-5xl",
        // "wide" and "full" fill the panel, so big screens get more content
        // instead of empty gutters.
        className,
      )}
      {...props}
    />
  );
}

/** A titled block inside a page. Keeps section headings identical everywhere. */
export function PageSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
