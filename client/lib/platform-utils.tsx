import {
  YouTubeIcon,
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  BlueskyIcon,
  ThreadsIcon,
  PinterestIcon,
  LinkedInIcon,
} from "@/components/icons";
import type { IconProps } from "@/components/icons";

export const getPlatformIcon = (
  provider: string,
  { className, ...props }: IconProps
) => {
  switch (provider.toLowerCase()) {
    case "google":
      return <YouTubeIcon className={className} {...props} />;
    case "facebook":
      return <FacebookIcon className={className} {...props} />;
    case "instagram":
      return <InstagramIcon className={className} {...props} />;
    case "tiktok":
      return <TikTokIcon className={className} {...props} />;
    case "bluesky":
      return <BlueskyIcon className={className} {...props} />;
    case "threads":
      return <ThreadsIcon className={className} {...props} />;
    case "pinterest":
      return <PinterestIcon className={className} {...props} />;
    case "linkedin":
      return <LinkedInIcon className={className} {...props} />;
    default:
      return null;
  }
};

export const getPlatformColor = (provider: string) => {
  switch (provider.toLowerCase()) {
    case "google":
      return "text-red-500";
    case "facebook":
      return "text-blue-600";
    case "instagram":
      return "text-pink-500";
    case "tiktok":
      return "text-black dark:text-white";
    case "bluesky":
      return "text-sky-500";
    case "threads":
      return "text-black dark:text-white";
    case "pinterest":
      return "text-red-600";
    case "linkedin":
      return "text-[#0A66C2]";
    default:
      return "text-muted-foreground";
  }
};

export const getPlatformBgColor = (provider: string) => {
  switch (provider.toLowerCase()) {
    case "google":
      return "bg-red-500";
    case "facebook":
      return "bg-blue-600";
    case "instagram":
      return "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500";
    case "tiktok":
      return "bg-black dark:bg-white";
    case "bluesky":
      return "bg-sky-500";
    case "threads":
      return "bg-black dark:bg-white";
    case "pinterest":
      return "bg-red-600";
    case "linkedin":
      return "bg-[#0A66C2]";
    default:
      return "bg-muted";
  }
};

/**
 * Format an account username as an @handle. Some providers (YouTube's
 * customUrl) already include the leading "@", so strip it first to avoid
 * rendering "@@name".
 */
export const formatHandle = (username: string) =>
  `@${username.replace(/^@+/, "")}`;

export const getPlatformName = (provider: string) => {
  switch (provider.toLowerCase()) {
    case "google":
      return "YouTube";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "bluesky":
      return "Bluesky";
    case "threads":
      return "Threads";
    case "pinterest":
      return "Pinterest";
    case "linkedin":
      return "LinkedIn";
    default:
      return provider;
  }
};
