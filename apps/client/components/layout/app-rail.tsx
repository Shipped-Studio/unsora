"use client";

import { Button, buttonVariants } from "@/components/ui/button";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretRight,
  CaretUpDown,
  CreditCard,
  GearSix,
  House,
  ListChecks,
  Plus,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  DotsThreeOutline,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { usePricing } from "@/contexts/pricing-context";
import { useUserUsage } from "@/hooks/use-user-usage";
import {
  CREATE_GROUPS,
  DOCS_URL,
  NAV_SECTIONS,
  isNavItemActive,
  type CreateGroupName,
  type NavItem,
} from "@/lib/navigation";
import { openCreditPacks } from "@/lib/toast-error";
import { cn } from "@/lib/utils";

/* ── Drawer and collapse state ────────────────────────────────────────── */

const COLLAPSED_KEY = "sidebarCollapsed";

const AppNavContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
  collapsed: false,
  setCollapsed: () => {},
});

const collapsedListeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  return () => collapsedListeners.delete(listener);
}

export function AppNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Expanded on the server, then whatever this browser remembered.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  const setCollapsed = (value: boolean) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
    } catch {}
    collapsedListeners.forEach((listener) => listener());
  };

  return (
    <AppNavContext.Provider value={{ open, setOpen, collapsed, setCollapsed }}>
      {children}
    </AppNavContext.Provider>
  );
}

export const useAppNav = () => useContext(AppNavContext);

/* ── Navigation model ─────────────────────────────────────────────────── */

const section = (label: string) => NAV_SECTIONS.find((s) => s.label === label)!;
const byHref = (href: string) =>
  NAV_SECTIONS.flatMap((s) => [...s.items, ...(s.more ?? [])]).find((item) => item.href === href)!;

const SCHEDULE = section("Schedule").items;
const CREATE = section("Create");
const WORKSPACE: NavItem[] = [byHref("/files"), byHref("/connect-agent")];

const itemClass = (active: boolean, collapsed: boolean) =>
  cn(
    "flex h-9 w-full min-w-0 items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    collapsed ? "justify-center px-0" : "px-2.5",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
  );

/** Wraps a nav control in a right-side tooltip, only when the sidebar is collapsed. */
function WithTip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactElement;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(item, pathname);
  return (
    <WithTip label={item.label} collapsed={collapsed}>
      <Link
        href={item.href}
        onClick={onNavigate}
        target={item.external ? "_blank" : undefined}
        className={itemClass(active, collapsed)}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
      >
        <item.icon className="size-[1.125rem] shrink-0" />
        {collapsed ? null : <span className="truncate">{item.label}</span>}
      </Link>
    </WithTip>
  );
}

function GroupLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-5 bg-border" />;
  return (
    <p className="px-2.5 pt-4 pb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground/80 uppercase">
      {children}
    </p>
  );
}

/**
 * The AI tools. The two most used (Clips, Video) are plain sidebar links;
 * "More tools" opens all of them, grouped by what they make (Video, Image,
 * Audio), in a panel beside the sidebar. In the phone drawer, where a side
 * panel won't fit, the same groups show as a list.
 */
function CreateGroup({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const onOtherTool = CREATE_TOOLS.some(
    (item) => !PINNED_TOOLS.includes(item) && isNavItemActive(item, pathname),
  );

  if (onNavigate) {
    return (
      <div className="space-y-0.5">
        {CREATE_GROUPS.map((group) => (
          <div key={group} className="space-y-0.5">
            <p className="px-2.5 pt-2 pb-1 text-2xs font-medium text-muted-foreground/80">{group}</p>
            {toolsIn(group).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const trigger = (
    <button
      type="button"
      aria-label={collapsed ? "More AI tools" : undefined}
      className={cn(itemClass(onOtherTool, collapsed), open && !onOtherTool && "bg-foreground/[0.05] text-foreground")}
    />
  );

  return (
    <div className="space-y-0.5">
      {PINNED_TOOLS.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <WithTip label="More AI tools" collapsed={collapsed}>
          <PopoverTrigger render={trigger}>
            <AiBadge />
            {collapsed ? null : (
              <>
                <span className="flex-1 truncate text-left">More tools</span>
                <CaretRight className="size-3.5 shrink-0 opacity-60" />
              </>
            )}
          </PopoverTrigger>
        </WithTip>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-[min(46rem,calc(100vw-6rem))] gap-0 rounded-2xl p-0"
        >
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <AiBadge className="size-8 rounded-lg text-xs" />
            <div>
              <p className="font-display text-base font-semibold tracking-tight">Create with AI</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Make something new, then schedule it from your library.</p>
            </div>
          </div>
          <div className="grid gap-x-4 gap-y-5 p-3 sm:grid-cols-2">
            {/* Video has the most tools, so it gets a column; Image and Audio share the other. */}
            <ToolGroup group="Video" pathname={pathname} onPick={() => setOpen(false)} />
            <div className="space-y-5">
              <ToolGroup group="Image" pathname={pathname} onPick={() => setOpen(false)} />
              <ToolGroup group="Audio" pathname={pathname} onPick={() => setOpen(false)} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const CREATE_TOOLS = [...CREATE.items, ...(CREATE.more ?? [])];
/** Shown as plain sidebar links above "More tools". */
const PINNED_TOOLS = [byHref("/ai-clipping"), byHref("/video-generator")];

/** The mark for the AI tools: "AI" on the brand colour. */
function AiBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[1.125rem] shrink-0 items-center justify-center rounded-[5px] bg-brand text-[0.5625rem] leading-none font-bold tracking-tight text-brand-foreground",
        className,
      )}
    >
      AI
    </span>
  );
}
const toolsIn = (group: CreateGroupName) => CREATE_TOOLS.filter((item) => item.group === group);

function ToolGroup({
  group,
  pathname,
  onPick,
}: {
  group: CreateGroupName;
  pathname: string;
  onPick: () => void;
}) {
  return (
    <section>
      <p className="px-2 pb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground/80 uppercase">{group}</p>
      <ul className="space-y-0.5">
        {toolsIn(group).map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onPick}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/tool flex items-center gap-3 rounded-xl p-2 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "bg-accent" : "hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors",
                    active
                      ? "bg-brand text-brand-foreground ring-transparent"
                      : "bg-card text-foreground ring-border group-hover/tool:bg-brand group-hover/tool:text-brand-foreground group-hover/tool:ring-transparent",
                  )}
                >
                  <item.icon className="size-[1.125rem]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatCredits(credits: number) {
  return new Intl.NumberFormat(undefined, { notation: credits >= 10_000 ? "compact" : "standard" }).format(credits);
}

/**
 * The balance, or with none, what the user needs next: a plan to post, or
 * credits for the AI tools. Plans include no credits, so it never says "0".
 */
function balanceLine(credits: number, isFree: boolean) {
  if (credits > 0) return `${formatCredits(credits)} credits`;
  return isFree ? "Choose a plan to post" : "AI tools use credits";
}

/** Plan and credit balance, with the one action that matters for it. */
function PlanCard({ collapsed }: { collapsed: boolean }) {
  const { usage } = useUserUsage();
  const { openPricing } = usePricing();
  if (!usage || collapsed) return null;
  const plan = usage.user.plan ?? "free";
  const isFree = plan.toLowerCase() === "free";

  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground capitalize">{plan} plan</p>
        <Link href="/billing" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Billing
        </Link>
      </div>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{balanceLine(usage.credits, isFree)}</p>
      {isFree ? (
        <Button size="xs" className="mt-2.5 w-full" onClick={openPricing}>
          Upgrade
        </Button>
      ) : usage.credits <= 0 ? (
        <Button size="xs" className="mt-2.5 w-full" onClick={openCreditPacks}>
          Buy credits
        </Button>
      ) : null}
    </div>
  );
}

function UserMenu({ collapsed, side = "right" }: { collapsed: boolean; side?: "right" | "top" }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { usage } = useUserUsage();
  const { openPricing } = usePricing();
  if (!user) return <div className="h-11" />;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = user.fullName || email;
  const initials =
    (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") || email[0]?.toUpperCase() || "U";
  const isFree = Boolean(usage) && (usage?.user?.plan ?? "free").toLowerCase() === "free";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              "flex w-full min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50 ",
              collapsed && "justify-center",
            )}
          />
        }
      >
        <Avatar className="size-8">
          <AvatarImage src={user.imageUrl} alt="" />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              {user.fullName ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
            </span>
            <CaretUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" sideOffset={10} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            {user.fullName ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {/* Expanded, the plan card above the menu already shows this. */}
        {collapsed ? (
          <div className="mx-1.5 mb-1.5 flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground capitalize">
                {usage ? `${usage.user.plan ?? "free"} plan` : "Credits"}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {usage ? balanceLine(usage.credits, isFree) : "–"}
              </p>
            </div>
            {isFree ? (
              <Button size="xs" onClick={openPricing}>
                Upgrade
              </Button>
            ) : (
              <Link href="/billing#credits" className={buttonVariants({ variant: "outline", size: "xs" })}>
                Buy credits
              </Link>
            )}
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings" />}>
            <GearSix />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/billing" />}>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          {usage?.user?.isAdmin ? (
            <DropdownMenuItem render={<Link href="/admin" />}>
              <ShieldCheck />
              Admin
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem render={<a href={DOCS_URL} target="_blank" rel="noopener noreferrer" />}>
            <ArrowSquareOut />
            Documentation
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/sign-in" })}>
          <SignOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Everything in the sidebar, shared by the desktop column and the phone drawer. */
function SidebarBody({
  collapsed,
  onNavigate,
  userMenuSide = "right",
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  userMenuSide?: "right" | "top";
}) {
  const pathname = usePathname();

  return (
    <>
      <WithTip label="New post" collapsed={collapsed}>
        <Link
          href="/scheduler/new"
          onClick={onNavigate}
          aria-label={collapsed ? "New post" : undefined}
          className={cn(
            buttonVariants({ size: collapsed ? "icon-lg" : "lg" }),
            collapsed ? "mx-auto" : "w-full",
          )}
        >
          <Plus className="size-4" weight="bold" />
          {collapsed ? null : "New post"}
        </Link>
      </WithTip>

      <nav aria-label="Main" className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar">
        <GroupLabel collapsed={collapsed}>Schedule</GroupLabel>
        <div className="space-y-0.5">
          {SCHEDULE.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>

        <GroupLabel collapsed={collapsed}>Create</GroupLabel>
        <CreateGroup pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />

        <GroupLabel collapsed={collapsed}>Workspace</GroupLabel>
        <div className="space-y-0.5">
          {WORKSPACE.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
          <NavLink
            item={{ label: "Settings", href: "/settings", icon: GearSix }}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </div>
      </nav>

      <div className="mt-3 space-y-2">
        <PlanCard collapsed={collapsed} />
        <UserMenu collapsed={collapsed} side={userMenuSide} />
      </div>
    </>
  );
}

/** Desktop sidebar: labelled, collapsible to an icon column. */
export function AppRail() {
  const { collapsed, setCollapsed } = useAppNav();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col py-3 transition-[width] duration-200 md:flex",
        collapsed ? "w-[4.25rem] px-2.5" : "w-60 px-3",
      )}
    >
      <div className={cn("mb-4 flex h-9 items-center", collapsed ? "justify-center" : "justify-between pl-1.5")}>
        {collapsed ? null : (
          <Link href="/" aria-label="Unsora home" className="flex items-center">
            <UnsoraLogo variant="full" priority className="h-6" />
          </Link>
        )}
        <WithTip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} collapsed>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground"
          >
            <SidebarSimple className="size-[1.125rem]" />
          </Button>
        </WithTip>
      </div>
      <SidebarBody collapsed={collapsed} />
    </aside>
  );
}

/** Phone navigation: the same sidebar in a drawer. */
export function MobileNav() {
  const { open, setOpen } = useAppNav();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-76 gap-0 bg-sidebar p-3">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="mb-4 flex h-9 items-center pl-1.5">
          <UnsoraLogo variant="full" className="h-6" />
        </div>
        <SidebarBody collapsed={false} onNavigate={() => setOpen(false)} userMenuSide="top" />
      </SheetContent>
    </Sheet>
  );
}

/** Routes with their own bottom dock (composer, editor), where the tab bar would cover it. */
const NO_TAB_BAR = [/^\/scheduler\/new/, /^\/scheduler\/posts\/[^/]+\/edit/, /^\/subtitle-editor\/[^/]+$/];

const TAB_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: House, exact: true },
  { label: "Calendar", href: "/scheduler/calendar", icon: CalendarBlank },
  { label: "Posts", href: "/scheduler/posts", icon: ListChecks },
];

export const hasTabBar = (pathname: string) => !NO_TAB_BAR.some((re) => re.test(pathname));

/** Phone tab bar: the scheduler one tap away, with New post in the middle. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { setOpen } = useAppNav();
  if (!hasTabBar(pathname)) return null;

  const tab = (item: NavItem) => {
    const active = isNavItemActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-1.5 text-2xs font-medium",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <item.icon className="size-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t bg-card/95 px-2 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      {tab(TAB_ITEMS[0])}
      {tab(TAB_ITEMS[1])}
      <div className="flex flex-1 justify-center">
        <Link
          href="/scheduler/new"
          aria-label="New post"
          className={cn(buttonVariants({ size: "icon-lg" }), "-mt-3 size-12 rounded-full shadow-md")}
        >
          <Plus className="size-5" weight="bold" />
        </Link>
      </div>
      {tab(TAB_ITEMS[2])}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-1 flex-col items-center gap-1 py-1.5 text-2xs font-medium text-muted-foreground"
      >
        <DotsThreeOutline className="size-5" />
        More
      </button>
    </nav>
  );
}
