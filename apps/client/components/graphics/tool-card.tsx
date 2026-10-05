import Link from "next/link";
import { ALL_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ToolArt } from "./tool-art";

/**
 * A Create tool as a soft grey card: its drawn scene on top, name and one
 * line below. The scene plays while the card is hovered or focused.
 */
export function ToolCard({ href, className }: { href: string; className?: string }) {
  const item = ALL_NAV_ITEMS.find((i) => i.href === href);
  if (!item) return null;
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-xl bg-muted transition-colors hover:bg-accent",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ToolArt href={href} motion="hover" />
      <span className="flex min-w-0 flex-col gap-0.5 px-3.5 pb-3.5">
        <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
        {item.description ? (
          <span className="line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
        ) : null}
      </span>
    </Link>
  );
}
