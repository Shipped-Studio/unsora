import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsOut,
  ArrowSquareOut,
  CalendarBlank,
  ChartBar,
  Eraser,
  FilmSlate,
  Folder,
  FrameCorners,
  House,
  ImageSquare,
  ImagesSquare,
  Key,
  ListChecks,
  Microphone,
  MusicNotes,
  PersonSimpleRun,
  Queue,
  Plugs,
  Scissors,
  ShareNetwork,
  SquaresFour,
  TextT,
  UserFocus,
  UserSound,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";

export const DOCS_URL = "https://tryunsora.com/docs";
export const MCP_URL = "https://mcp.tryunsora.com/mcp";
export const API_BASE = "https://mvp.tryunsora.com/api/v1";
/**
 * Video shown on the last onboarding step (a YouTube watch/share/embed URL).
 * Empty: the step shows "what to try next" cards instead.
 */
export const TUTORIAL_VIDEO_URL = "";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  /** One line, shown in the page header and the command menu. */
  description?: string;
  /** Only highlight on an exact path match. */
  exact?: boolean;
  /** Extra path prefixes that should also highlight this item. */
  match?: string[];
  external?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  /** Items tucked behind a "More" disclosure. */
  more?: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Publish",
    items: [
      {
        label: "Home",
        href: "/",
        icon: House,
        description: "What needs attention and what's going out next",
        exact: true,
      },
      {
        label: "Calendar",
        href: "/scheduler/calendar",
        icon: CalendarBlank,
        description: "Scheduled and published posts by date",
        // Queue and Posts are reached from the tabs on these pages.
        match: ["/scheduler/queue", "/scheduler/posts"],
      },
      {
        label: "Queue",
        href: "/scheduler/queue",
        icon: Queue,
        description: "What goes out next, and your posting times",
      },
      {
        label: "Posts",
        href: "/scheduler/posts",
        icon: ListChecks,
        description: "Every post, filterable by status",
      },
      {
        label: "Analytics",
        href: "/scheduler/analytics",
        icon: ChartBar,
        description: "Views, likes and comments on published posts",
      },
      {
        label: "Accounts",
        href: "/scheduler/accounts",
        icon: ShareNetwork,
        description: "Social accounts you can publish to",
      },
    ],
  },
  {
    label: "Create",
    items: [
      {
        label: "All tools",
        href: "/create",
        icon: SquaresFour,
        description: "Every AI tool, grouped by what it makes",
      },
      {
        label: "Video",
        href: "/video-generator",
        icon: VideoCamera,
        description: "Generate video from a prompt or reference images",
      },
      {
        label: "Image",
        href: "/image-generator",
        icon: ImageSquare,
        description: "Generate and edit images from a prompt",
      },
      {
        label: "Clips",
        href: "/ai-clipping",
        icon: Scissors,
        description: "Cut short clips out of a long video",
      },
      {
        label: "Subtitles",
        href: "/subtitle-editor",
        icon: TextT,
        description: "Transcribe, style and burn in captions",
      },
      {
        label: "Thumbnails",
        href: "/thumbnail-generator",
        icon: ImagesSquare,
        description: "YouTube thumbnails from a prompt or template",
      },
    ],
    more: [
      {
        label: "Motion control",
        href: "/motion-control",
        icon: PersonSimpleRun,
        description: "Animate a character with a reference video",
      },
      {
        label: "AI influencer",
        href: "/ai-influencer-studio",
        icon: UserFocus,
        description: "Photos of one consistent character",
      },
      {
        label: "Movie materials",
        href: "/movie-materials-generator",
        icon: FilmSlate,
        description: "Characters, locations and shot stills for a script",
      },
      {
        label: "Upscale video",
        href: "/video-upscaler",
        icon: ArrowsOut,
        description: "Increase video resolution",
      },
      {
        label: "Upscale image",
        href: "/image-upscaler",
        icon: FrameCorners,
        description: "Increase image resolution",
      },
      {
        label: "Remove subtitles",
        href: "/subtitle-remover",
        icon: Eraser,
        description: "Erase burned-in text from a video",
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        label: "Library",
        href: "/files",
        icon: Folder,
        description: "Uploads, imports and everything you've generated",
      },
    ],
  },
  {
    label: "Developers",
    items: [
      {
        label: "API keys",
        href: "/api-keys",
        icon: Key,
        description: "Keys for the REST API and MCP server",
      },
      {
        label: "Agents",
        href: "/connect-agent",
        icon: Plugs,
        description: "Connect Claude, Cursor or ChatGPT over MCP",
      },
      {
        label: "API docs",
        href: DOCS_URL,
        icon: ArrowSquareOut,
        external: true,
      },
    ],
  },
];

/** Tools that exist but aren't in the sidebar. They still get a page title. */
const UNLISTED: NavItem[] = [
  {
    label: "New post",
    href: "/scheduler/new",
    icon: ListChecks,
    description: "Pick what kind of post to make",
  },
  {
    label: "Music",
    href: "/music-generator",
    icon: MusicNotes,
    description: "Songs from lyrics and a style prompt",
  },
  {
    label: "Voice",
    href: "/voice-generator",
    icon: Microphone,
    description: "Text to speech with stock or cloned voices",
  },
  {
    label: "Voice changer",
    href: "/voice-changer",
    icon: Waveform,
    description: "Re-voice a recording with one of your cloned voices",
  },
  {
    label: "Talking avatar",
    href: "/ai-avatar-maker",
    icon: UserSound,
    description: "A portrait that speaks your script",
  },
  {
    label: "Thumbnail templates",
    href: "/thumbnail-generator/templates",
    icon: ImagesSquare,
    description: "Preset and custom thumbnail templates",
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => [...s.items, ...(s.more ?? [])]),
  ...UNLISTED,
];

/** The Create tools as the /create page groups them, by route. */
export const TOOL_GROUPS: { label: string; hrefs: string[] }[] = [
  {
    label: "Video",
    hrefs: [
      "/video-generator",
      "/ai-clipping",
      "/ai-avatar-maker",
      "/motion-control",
      "/video-upscaler",
    ],
  },
  {
    label: "Image",
    hrefs: [
      "/image-generator",
      "/thumbnail-generator",
      "/ai-influencer-studio",
      "/movie-materials-generator",
      "/image-upscaler",
    ],
  },
  {
    label: "Audio",
    hrefs: ["/voice-generator", "/voice-changer", "/music-generator"],
  },
  {
    label: "Captions",
    hrefs: ["/subtitle-editor", "/subtitle-remover"],
  },
];

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.external) return false;
  const matches = (href: string, exact?: boolean) =>
    exact || href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  if (item.match?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)))
    return true;
  if (matches(item.href, item.exact)) {
    // A more specific sibling (e.g. Calendar under Posts) wins.
    return !ALL_NAV_ITEMS.some(
      (other) =>
        other !== item &&
        other.href.length > item.href.length &&
        other.href.startsWith(`${item.href}/`) &&
        (pathname === other.href || pathname.startsWith(`${other.href}/`)),
    );
  }
  return false;
}

/** Exact route lookup, used by tool pages to title themselves. */
export function findNavItem(pathname: string) {
  return ALL_NAV_ITEMS.find((item) => item.href === pathname);
}
