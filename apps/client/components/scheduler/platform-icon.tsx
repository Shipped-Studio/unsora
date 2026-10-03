import {
  BlueskyIcon,
  FacebookIcon,
  GoogleBusinessIcon,
  InstagramIcon,
  LinkedInIcon,
  PinterestIcon,
  ThreadsIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Round brand badge for a platform. Every platform renders as a filled
 * circle so they line up in lists, avatar stacks and calendar chips.
 */
export function PlatformIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const base = cn("size-4 shrink-0", className);

  switch (provider) {
    case "instagram":
      return <InstagramIcon className={base} aria-hidden />;
    case "tiktok":
      return <TikTokIcon className={base} aria-hidden />;
    case "google":
      return <YouTubeIcon className={base} aria-hidden />;
    case "facebook":
      return <FacebookIcon className={base} aria-hidden />;
    case "pinterest":
      return (
        <span className={cn(base, "inline-block rounded-full bg-platform-foreground")} aria-hidden>
          <PinterestIcon className="size-full" />
        </span>
      );
    case "linkedin":
      return (
        <span
          className={cn(base, "flex items-center justify-center rounded-full bg-platform-linkedin")}
          aria-hidden
        >
          <LinkedInIcon className="size-[55%] [&_path]:fill-platform-foreground" />
        </span>
      );
    case "bluesky":
      return (
        <span
          className={cn(base, "flex items-center justify-center rounded-full bg-platform-bluesky")}
          aria-hidden
        >
          <BlueskyIcon className="size-[58%] [&_path]:fill-platform-foreground" />
        </span>
      );
    case "x":
      return (
        <span
          className={cn(
            base,
            "flex items-center justify-center rounded-full bg-platform-x text-platform-foreground ring-1 ring-platform-foreground/15",
          )}
          aria-hidden
        >
          <XIcon className="size-[50%]" />
        </span>
      );
    case "google_business":
      return (
        <span
          className={cn(
            base,
            "flex items-center justify-center rounded-full bg-platform-google-business",
          )}
          aria-hidden
        >
          <GoogleBusinessIcon className="size-[55%] [&_path]:fill-platform-foreground" />
        </span>
      );
    case "threads":
      return (
        <span
          className={cn(
            base,
            "flex items-center justify-center rounded-full bg-platform-threads text-platform-foreground ring-1 ring-platform-foreground/15",
          )}
          aria-hidden
        >
          <ThreadsIcon className="size-[58%]" />
        </span>
      );
    default:
      return <span className={cn(base, "rounded-full bg-muted")} aria-hidden />;
  }
}
