"use client";

import { Button, buttonVariants } from "@/components/ui/button";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  CaretUpDown,
  Compass,
  CreditCard,
  Desktop,
  DotsThreeOutline,
  GearSix,
  House,
  ListChecks,
  Moon,
  Plus,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  Sparkle,
  Sun,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { useProductTour } from "@/components/onboarding/product-tour";
import { usePricing } from "@/contexts/pricing-context";
import { useUserUsage } from "@/hooks/use-user-usage";
import { DOCS_URL, NAV_SECTIONS, isNavItemActive, type NavItem } from "@/lib/navigation";
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
        data-tour={item.href}
        onClick={onNavigate}
        target={item.external ? "_blank" : undefined}
        className={itemClass(active, collapsed)}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
      >
        <item.icon className="size-[1.125rem] shrink-0" weight={active ? "duotone" : "regular"} />
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
 * AI tools sit in one disclosure, so the scheduler stays the first thing you
 * see. It opens by itself while you're on a tool page. Collapsed, it turns
 * into a flyout menu.
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
  const all = [...CREATE.items, ...(CREATE.more ?? [])];
  const onTool = all.some((item) => isNavItemActive(item, pathname));
  const onMoreTool = (CREATE.more ?? []).some((item) => isNavItemActive(item, pathname));
  // Follows the page until the user opens or closes it themselves.
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const [moreChoice, setMoreOpen] = useState<boolean | null>(null);
  const open = openChoice ?? onTool;
  const moreOpen = moreChoice || onMoreTool;

  if (collapsed) {
    return (
      <DropdownMenu>
        <WithTip label="Create with AI" collapsed>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                data-tour="create"
                aria-label="Create with AI"
                className={itemClass(onTool, true)}
              />
            }
          >
            <Sparkle className="size-[1.125rem]" weight={onTool ? "duotone" : "regular"} />
          </DropdownMenuTrigger>
        </WithTip>
        <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Create with AI</DropdownMenuLabel>
            {all.map((item) => (
              <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                <item.icon />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        data-tour="create"
        className={cn(itemClass(false, false), "group/create", onTool && !open && "text-foreground")}
      >
        <Sparkle className="size-[1.125rem] shrink-0" weight={onTool ? "duotone" : "regular"} />
        <span className="flex-1 truncate text-left">Create with AI</span>
        <CaretDown className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/create:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="mt-0.5 ml-[1.0625rem] space-y-0.5 border-l pl-2">
          {CREATE.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} onNavigate={onNavigate} />
          ))}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            {moreOpen ? null : (
              <CollapsibleTrigger className={itemClass(false, false)}>
                <DotsThreeOutline className="size-[1.125rem] shrink-0" />
                <span className="truncate">More tools</span>
              </CollapsibleTrigger>
            )}
            <CollapsibleContent className="space-y-0.5">
              {(CREATE.more ?? []).map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} onNavigate={onNavigate} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatCredits(credits: number) {
  return new Intl.NumberFormat(undefined, { notation: credits >= 10_000 ? "compact" : "standard" }).format(credits);
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
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCredits(usage.credits)} credits</p>
      {isFree ? (
        <Button size="xs" className="mt-2.5 w-full" onClick={openPricing}>
          Upgrade
        </Button>
      ) : null}
    </div>
  );
}

function UserMenu({ collapsed, side = "right" }: { collapsed: boolean; side?: "right" | "top" }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const { usage } = useUserUsage();
  const { openPricing } = usePricing();
  const { startTour } = useProductTour();
  const { setOpen: setNavOpen } = useAppNav();
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
              "flex w-full min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-foreground/[0.06]",
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
                {usage ? `${formatCredits(usage.credits)} credits` : "–"}
              </p>
            </div>
            {isFree ? (
              <Button size="xs" onClick={openPricing}>
                Upgrade
              </Button>
            ) : (
              <Link href="/billing" className={buttonVariants({ variant: "outline", size: "xs" })}>
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <Desktop />}
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(value as string)}>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onClick={() => {
              // On phones the menu sits in the nav drawer; close it so the
              // tour can point at the page.
              setNavOpen(false);
              window.setTimeout(startTour, 300);
            }}
          >
            <Compass />
            Take the tour
          </DropdownMenuItem>
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
          data-tour="new-post"
          aria-label={collapsed ? "New post" : undefined}
          className={cn(
            buttonVariants({ size: collapsed ? "icon-lg" : "lg" }),
            collapsed ? "mx-auto" : "w-full justify-start",
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
        <item.icon className="size-5" weight={active ? "duotone" : "regular"} />
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
        <Sparkle className="size-5" />
        More
      </button>
    </nav>
  );
}
