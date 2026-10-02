"use client";

import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { CalendarPlus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { scheduleHref } from "@/lib/scheduler/formats";
import { cn } from "@/lib/utils";

/**
 * Layout for every Create tool: header, results, then the composer dock.
 * The page scrolls as a whole; the header sticks to the top and the dock
 * (a child using BOTTOM_PROMPT_DOCK_CLASS) sticks to the bottom.
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
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title={title} description={description} actions={actions} />
      <div className={cn("flex-1 px-3 py-4 sm:px-6 sm:py-6", className)}>
        {children}
      </div>
      {dock}
    </div>
  );
}

const GRID_COLUMNS = {
  square: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5",
  video: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
  portrait: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6",
} as const;

/** Results grid. Use the shape that matches the tool's output. */
export function ToolGrid({
  shape = "square",
  className,
  children,
}: {
  shape?: keyof typeof GRID_COLUMNS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-3", GRID_COLUMNS[shape], className)}>
      {children}
    </div>
  );
}

/** Empty results state, sized to sit above the dock. */
export function ToolEmpty({
  icon: IconComponent,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <Empty className="min-h-[45svh] border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconComponent />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
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
