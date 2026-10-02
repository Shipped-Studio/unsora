"use client";

import Link from "next/link";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
  House,
  Files,
  Sparkle,
  CalendarBlank,
  SignIn,
  Lightning,
  Sun,
  Moon,
  SignOut,
  CreditCard,
  Key,
  Sliders,
  Robot,
  VideoCamera,
  ImageSquare,
  PersonSimpleRun,
  UserFocus,
  FilmSlate,
  ImagesSquare,
  TextT,
  Eraser,
  Scissors,
  ArrowsOut,
  FrameCorners,
  ArrowSquareOut,
  Plugs,
  CaretRight,
  PaperPlaneTilt,
  CalendarDots,
  ShareNetwork,
  SquaresFour,
  ListBullets,
  CheckCircle,
  NotePencil,
  ChartBar,
  ShieldStar,
  PlusCircle,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { usePricing } from "@/contexts/pricing-context";
import { useUserUsage } from "@/hooks/use-user-usage";
import { DOCS_URL } from "@/components/dashboard/agent-connect-card";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import type { IconProps } from "@phosphor-icons/react";

interface GroupItem {
  icon: ComponentType<IconProps>;
  label: string;
  description: string;
  href: string;
  external?: boolean;
  /** Highlight only on an exact path match (for parent routes with sub-links). */
  exact?: boolean;
}

interface NavGroup {
  icon: ComponentType<IconProps>;
  label: string;
  heading: string;
  items: GroupItem[];
}

interface NavLink {
  icon: ComponentType<IconProps>;
  label: string;
  href: string;
}

type NavEntry =
  | { kind: "link"; link: NavLink }
  | { kind: "group"; group: NavGroup };

const NAV: NavEntry[] = [
  { kind: "link", link: { icon: House, label: "Home", href: "/" } },
  {
    kind: "group",
    group: {
      icon: VideoCamera,
      label: "Video",
      heading: "Generate & direct video",
      items: [
        {
          icon: VideoCamera,
          label: "Video Generation",
          description: "Sora, Veo, Kling, Seedance",
          href: "/video-generator",
        },
        {
          icon: PersonSimpleRun,
          label: "Motion Control",
          description: "Animate with reference video",
          href: "/motion-control",
        },
      ],
    },
  },
  {
    kind: "group",
    group: {
      icon: ImageSquare,
      label: "Image",
      heading: "Generate & design images",
      items: [
        {
          icon: ImageSquare,
          label: "Image Generation",
          description: "Text to image",
          href: "/image-generator",
        },
        {
          icon: ImagesSquare,
          label: "Thumbnail Generator",
          description: "YouTube-ready thumbnails",
          href: "/thumbnail-generator",
        },
        {
          icon: FilmSlate,
          label: "Movie Materials",
          description: "Shot lists & scene packs",
          href: "/movie-materials-generator",
        },
        {
          icon: UserFocus,
          label: "AI Influencer Studio",
          description: "Consistent characters",
          href: "/ai-influencer-studio",
        },
      ],
    },
  },

  {
    kind: "link",
    link: {
      icon: Scissors,
      label: "AI Clipping",
      href: "/ai-clipping",
    },
  },
  {
    kind: "link",
    link: {
      icon: TextT,
      label: "Subtitle Editor",
      href: "/subtitle-editor",
    },
  },

  {
    kind: "group",
    group: {
      icon: Sliders,
      label: "Enhance",
      heading: "Upscale & clean media",
      items: [
        {
          icon: ArrowsOut,
          label: "Video Upscaler",
          description: "Up to 4K / 8K",
          href: "/video-upscaler",
        },
        {
          icon: FrameCorners,
          label: "Image Upscaler",
          description: "Print-ready restoration",
          href: "/image-upscaler",
        },
        {
          icon: Eraser,
          label: "Subtitle Remover",
          description: "Erase burned-in subtitles",
          href: "/subtitle-remover",
        },
      ],
    },
  },

  {
    kind: "group",
    group: {
      icon: CalendarBlank,
      label: "Scheduler",
      heading: "Plan & publish posts",
      items: [
        {
          icon: SquaresFour,
          label: "Overview",
          description: "Scheduler dashboard",
          href: "/scheduler",
          exact: true,
        },
        {
          icon: PlusCircle,
          label: "Create",
          description: "Compose and schedule a new post",
          href: "/scheduler/posts/create",
        },
        {
          icon: ListBullets,
          label: "All Posts",
          description: "View and manage all your posts",
          href: "/scheduler/posts",
          exact: true,
        },
        {
          icon: NotePencil,
          label: "Drafts",
          description: "Unfinished posts",
          href: "/scheduler/posts/draft",
        },
        {
          icon: ChartBar,
          label: "Analytics",
          description: "Views, likes & engagement",
          href: "/scheduler/analytics",
        },
        {
          icon: PaperPlaneTilt,
          label: "Scheduled",
          description: "Posts waiting to publish",
          href: "/scheduler/posts/scheduled",
        },
        {
          icon: CalendarDots,
          label: "Calendar",
          description: "Calendar view of your posts",
          href: "/scheduler/posts/calendar",
        },
        {
          icon: ShareNetwork,
          label: "Connections",
          description: "Connected social accounts",
          href: "/scheduler/connections",
        },
      ],
    },
  },
  { kind: "link", link: { icon: Files, label: "Files", href: "/files" } },
  {
    kind: "group",
    group: {
      icon: Robot,
      label: "Agents",
      heading: "Drive Unsora from your agent",
      items: [
        {
          icon: Key,
          label: "API Keys",
          description: "Create & revoke uns_live keys",
          href: "/api-keys",
        },
        {
          icon: Plugs,
          label: "Connect an agent",
          description: "Claude, Cursor & ChatGPT via MCP",
          href: "/connect-agent",
        },
        {
          icon: ArrowSquareOut,
          label: "API Docs",
          description: "Endpoints, auth, rate limits",
          href: DOCS_URL,
          external: true,
        },
      ],
    },
  },
];

function isNavActive(href: string, pathname: string, exact = false) {
  if (href.startsWith("#") || href.startsWith("http")) return false;
  const path = href.split("#")[0] || "/";
  if (path === "/" || exact) return pathname === path;
  return pathname.startsWith(path);
}

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) =>
    isNavActive(item.href, pathname, item.exact),
  );
}

function NavLinkItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const isActive = isNavActive(link.href, pathname);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={link.label}
        render={<Link href={link.href} />}
      >
        <link.icon weight={isActive ? "fill" : "regular"} />
        <span>{link.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroupItem({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const active = isGroupActive(group, pathname);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton isActive={active} tooltip={group.label}>
            <group.icon weight={active ? "fill" : "regular"} />
            <span>{group.label}</span>
            <CaretRight
              className={cn(
                "ml-auto transition-transform duration-200",
                open && "rotate-90",
              )}
            />
          </SidebarMenuButton>
        }
      />
      <CollapsibleContent>
        <SidebarMenuSub>
          {group.items.map((item) => {
            const itemActive = isNavActive(item.href, pathname, item.exact);
            return (
              <SidebarMenuSubItem key={item.label}>
                <SidebarMenuSubButton
                  isActive={itemActive}
                  title={item.description}
                  render={
                    item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ) : (
                      <Link href={item.href} />
                    )
                  }
                >
                  <span>{item.label}</span>
                  {item.external && (
                    <ArrowSquareOut className="ml-auto opacity-60" />
                  )}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  const { openPricing } = usePricing();
  const { usage, loading: usageLoading } = useUserUsage();
  const isDark = resolvedTheme === "dark";
  const isFree = !usage?.user?.plan || usage.user.plan.toLowerCase() === "free";

  const creditsLabel =
    usageLoading || !usage
      ? "—"
      : usage.credits >= 10_000
        ? `${(usage.credits / 1000).toFixed(1)}k credits`
        : `${usage.credits.toLocaleString()} credits`;

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              title="Unsora home"
              render={<Link href="/" />}
            >
              <UnsoraLogo variant="full" priority className="h-7 w-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((entry) =>
              entry.kind === "link" ? (
                <NavLinkItem
                  key={entry.link.label}
                  link={entry.link}
                  pathname={pathname}
                />
              ) : (
                <NavGroupItem
                  key={entry.group.label}
                  group={entry.group}
                  pathname={pathname}
                />
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isFree && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={openPricing}
                className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
              >
                <Lightning weight="fill" />
                <span className="font-semibold">Upgrade</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {(usage || usageLoading) && (
            <SidebarMenuItem>
              <SidebarMenuButton
                title={
                  usage
                    ? `${usage.credits.toLocaleString()} credits remaining`
                    : "Loading credits…"
                }
                render={<Link href="/billing" />}
              >
                <Sparkle weight="fill" />
                <span className="tabular-nums">{creditsLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {usage?.user?.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/admin")}
                render={<Link href="/admin" />}
              >
                <ShieldStar
                  weight={pathname.startsWith("/admin") ? "fill" : "regular"}
                />
                <span>Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/billing"}
              render={<Link href="/billing" />}
            >
              <CreditCard weight={pathname === "/billing" ? "fill" : "regular"} />
              <span>Billing</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun /> : <Moon />}
              <span>{isDark ? "Light" : "Dark"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {user ? (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton size="lg">
                      <Avatar className="size-8 rounded-lg">
                        <AvatarImage src={user.imageUrl} alt={user.fullName ?? ""} />
                        <AvatarFallback className="rounded-lg">
                          {user.firstName?.[0] ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                          {user.fullName}
                        </span>
                        <span className="truncate text-xs text-sidebar-foreground/70">
                          {user.primaryEmailAddress?.emailAddress}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  }
                />
                <DropdownMenuContent
                  side="right"
                  align="end"
                  sideOffset={4}
                  className="w-56"
                >
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <SignOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/sign-in" />}>
                <SignIn />
                <span>Sign In</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
