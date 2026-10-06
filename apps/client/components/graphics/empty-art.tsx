import { cn } from "@/lib/utils";
import { EMPTY_ILLUSTRATIONS, type EmptyIllustration } from "./empty-illustrations";

/*
 * Icons8 "Little" illustrations for empty scheduler and library screens. They
 * are inlined so their colours follow the theme tokens.
 */

export type EmptyArtName = EmptyIllustration;

export function EmptyArt({ name, className }: { name: EmptyArtName; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mx-auto flex h-36 justify-center select-none [&>svg]:h-full [&>svg]:w-auto",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: EMPTY_ILLUSTRATIONS[name] }}
    />
  );
}
