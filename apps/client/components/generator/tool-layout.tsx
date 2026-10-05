"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { CalendarPlus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/states";
import { ToolArt, hasToolArt } from "@/components/graphics/tool-art";
import { buttonVariants } from "@/components/ui/button";
import { scheduleHref } from "@/lib/scheduler/formats";
import { cn } from "@/lib/utils";

/**
 * Layout for every Create tool: header, results, then the composer dock.
 * The page scrolls as a whole; the header sticks to the top and the dock
 * (a child using BOTTOM_PROMPT_DOCK_CLASS) sticks to the bottom.
 *
 * Panel tools (music, voice, upscalers) pass `className="p-0 sm:p-0
 * lg:flex-row lg:items-start"` and render a ToolSidebar plus a ToolPane.
 */
export function ToolPage({
  title,
  description,
  actions,
  dock,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  /** The composer. Render it with BOTTOM_PROMPT_DOCK_CLASS as its wrapper. */
  dock?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  // At least as tall as the app panel (full height on phones, minus the 8px
  // inset at md+), so on short pages the results area grows and the dock
  // sits at the bottom instead of the white panel stopping early.
  return (
    <div className="flex min-h-svh flex-1 flex-col md:min-h-[calc(100svh-1rem)]">
      <PageHeader title={title} description={description} actions={actions} />
      <div
        className={cn("flex flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6", className)}
      >
        {children}
      </div>
      {dock}
    </div>
  );
}

/**
 * Settings panel for the panel tools. Stacks above the results on phones and
 * sits in a sticky column under the page header (h-16, md:h-18) from lg.
 * The app panel has an 8px inset at md+, hence the extra 1rem.
 */
export function ToolSidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "border-b lg:sticky lg:top-18 lg:h-[calc(100svh-5.5rem)] lg:w-95 lg:shrink-0 lg:border-r lg:border-b-0",
        className,
      )}
    >
      <div className="flex flex-col lg:h-full">{children}</div>
    </aside>
  );
}

/** Scrolling fields of a ToolSidebar. */
export function ToolSidebarBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-5 lg:overflow-y-auto">
      {children}
    </div>
  );
}

/**
 * The panel's submit row. Sticks to the bottom of the screen on phones (above
 * the music player when one is open) and sits under the fields from lg.
 */
export function ToolSidebarFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 border-t bg-card px-4 pt-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))] sm:px-5 lg:static lg:p-5">
      {children}
    </div>
  );
}

/** Results column next to a ToolSidebar. */
export function ToolPane({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="@container flex min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6 lg:min-h-[calc(100svh-5.5rem)]"
    >
      {children}
    </section>
  );
}

/*
 * Columns follow the width of the results area (container queries), so the
 * same tile size holds whether or not a side panel takes up room.
 */
const GRID_COLUMNS = {
  square: "grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-4 @7xl:grid-cols-5",
  video: "grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4",
  portrait:
    "grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @7xl:grid-cols-6",
} as const;

export type ToolGridShape = keyof typeof GRID_COLUMNS;

/** Results grid. Use the shape that matches the tool's output. */
export function ToolGrid({
  shape = "square",
  className,
  children,
}: {
  shape?: ToolGridShape;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="@container">
      <div className={cn("grid gap-3", GRID_COLUMNS[shape], className)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Empty results state, centred in whatever room is left between the header
 * and the dock (or beside the side panel). Shows the tool's drawn scene when
 * it has one, else the icon.
 */
export function ToolEmpty({
  icon,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  const pathname = usePathname();
  return (
    <div className="flex flex-1 flex-col justify-center">
      <EmptyState
        icon={icon}
        art={hasToolArt(pathname) ? <ToolArt href={pathname} /> : undefined}
        title={title}
        description={description}
      />
    </div>
  );
}

/** Opens the matching composer with this file attached. */
export function ScheduleLink({
  url,
  mediaType,
  className,
  size = "sm",
  variant = "outline",
}: {
  url: string;
  mediaType: "video" | "image";
  className?: string;
  size?: "xs" | "sm" | "default";
  variant?: "outline" | "default" | "secondary";
}) {
  return (
    <Link
      href={scheduleHref({ url, mediaType })}
      className={buttonVariants({ variant, size, className })}
      onClick={(event) => event.stopPropagation()}
    >
      <CalendarPlus />
      Schedule
    </Link>
  );
}
