"use client";

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
import { useEnabledPlatforms } from "@/hooks/use-connected-accounts";
import { cn } from "@/lib/utils";

type Icon = (props: { className?: string }) => React.ReactNode;

/** Platforms in the order they're listed everywhere else in the app. */
const PLATFORMS: { id: string; name: string; Icon: Icon }[] = [
  { id: "tiktok", name: "TikTok", Icon: TikTokIcon },
  { id: "instagram", name: "Instagram", Icon: InstagramIcon },
  { id: "google", name: "YouTube", Icon: YouTubeIcon },
  { id: "linkedin", name: "LinkedIn", Icon: LinkedInIcon },
  { id: "pinterest", name: "Pinterest", Icon: PinterestIcon },
  { id: "facebook", name: "Facebook", Icon: FacebookIcon },
  { id: "x", name: "X", Icon: XIcon },
  { id: "threads", name: "Threads", Icon: ThreadsIcon },
  { id: "bluesky", name: "Bluesky", Icon: BlueskyIcon },
  { id: "google_business", name: "Google Business Profile", Icon: GoogleBusinessIcon },
];

/**
 * "◆ POST TO" followed by the brand marks of every platform switched on for
 * this deployment. Renders nothing until the list has loaded.
 */
export function PostToRow({ className }: { className?: string }) {
  const { isEnabled, isLoading } = useEnabledPlatforms();
  const platforms = isLoading ? [] : PLATFORMS.filter((p) => isEnabled(p.id));
  if (platforms.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", className)}>
      <p className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span aria-hidden className="size-1.5 rotate-45 bg-foreground" />
        Post to
      </p>
      {/* Smaller and tighter on phones so every platform fits on one line. */}
      <ul className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-3 sm:gap-x-5">
        {platforms.map(({ id, name, Icon }) => (
          <li key={id} title={name} className="flex text-foreground">
            <Icon className="size-5 sm:size-6" />
            <span className="sr-only">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
