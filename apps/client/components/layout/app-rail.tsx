"use client";

import { Button, buttonVariants } from "@/components/ui/button";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
  ArrowSquareOut,
  CreditCard,
  Desktop,
  GearSix,
  Moon,
  Plus,
  ShieldCheck,
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { usePricing } from "@/contexts/pricing-context";
import { useUserUsage } from "@/hooks/use-user-usage";
import { DOCS_URL, NAV_SECTIONS, isNavItemActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/* ── Mobile drawer state ──────────────────────────────────────────────── */

const AppNavContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function AppNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <AppNavContext.Provider value={{ open, setOpen }}>{children}</AppNavContext.Provider>;
}

export const useAppNav = () => useContext(AppNavContext);

/* ── Navigation model ─────────────────────────────────────────────────── */

const section = (label: string) => NAV_SECTIONS.find((s) => s.label === label);
const byHref = (href: string) =>
  NAV_SECTIONS.flatMap((s) => s.items).find((item) => item.href === href)!;

/** The rail keeps the scheduler up top and folds tools into one Create menu. */
const RAIL_ITEMS: NavItem[] = [
  byHref("/"),
  byHref("/scheduler/calendar"),
  byHref("/scheduler/analytics"),
  byHref("/scheduler/accounts"),
];
const LIBRARY = byHref("/files");
const AGENTS = byHref("/connect-agent");
const CREATE_ITEMS = [...(section("Create")?.items ?? []), ...(section("Create")?.more ?? [])];

const railItemClass = (active: boolean) =>
  cn(
    "flex w-full shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-2xs leading-none font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  );

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(item, pathname);
  return (
    <Link href={item.href} className={railItemClass(active)} aria-current={active ? "page" : undefined}>
      <item.icon className="size-4.5" />
      <span>{item.label}</span>
    </Link>
  );
}

function CreateMenu({ pathname }: { pathname: string }) {
  const active = CREATE_ITEMS.some((item) => isNavItemActive(item, pathname));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={railItemClass(active)}>
            <Sparkle className="size-4.5" />
            <span>Create</span>
          </button>
        }
      />
      <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">AI tools</DropdownMenuLabel>
          {CREATE_ITEMS.map((item) => (
            <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
              <item.icon />
              <span className="flex-1">{item.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatCredits(credits: number) {
  return new Intl.NumberFormat(undefined, { notation: credits >= 10_000 ? "compact" : "standard" }).format(credits);
}

function UserMenu({ side = "right" }: { side?: "right" | "top" }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const { usage } = useUserUsage();
  const { openPricing } = usePricing();
  if (!user) return null;

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
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Avatar className="size-9">
          <AvatarImage src={user.imageUrl} alt="" />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" sideOffset={10} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            {user.fullName ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
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

/** Desktop icon rail: icon over label, grouped top and bottom. */
export function AppRail() {
  const pathname = usePathname();

  return (
    <aside className="my-2 ml-2 hidden w-[72px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto rounded-xl bg-card px-2 py-3 no-scrollbar md:flex">
      <Link href="/" aria-label="Unsora home" className="flex size-10 items-center justify-center">
        <UnsoraLogo variant="icon" priority className="size-8" />
      </Link>

      <Link
        href="/scheduler/new"
        aria-label="New post"
        className={buttonVariants({ size: "icon-lg" })}
      >
        <Plus className="size-4.5" weight="bold" />
      </Link>

      <nav aria-label="Main" className="flex w-full flex-1 flex-col gap-0.5">
        {RAIL_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="mx-3 my-1 h-px bg-border" />
        <CreateMenu pathname={pathname} />
        <RailLink item={LIBRARY} pathname={pathname} />
        <RailLink item={AGENTS} pathname={pathname} />
      </nav>

      <div className="flex w-full flex-col items-center gap-0.5">
        <RailLink
          item={{ label: "Settings", href: "/settings", icon: GearSix }}
          pathname={pathname}
        />
        <div className="pt-2">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}

/** Phone navigation: the full list in a drawer. */
export function MobileNav() {
  const pathname = usePathname();
  const { open, setOpen } = useAppNav();

  const row = (item: NavItem) => {
    const active = isNavItemActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        target={item.external ? "_blank" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
          active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-secondary",
        )}
      >
        <item.icon className="size-4.5" />
        {item.label}
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-80 gap-0 overflow-y-auto p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <UnsoraLogo variant="full" className="h-6" />
          <UserMenu side="top" />
        </div>
        <div className="space-y-5 p-3">
          <Link
            href="/scheduler/new"
            onClick={() => setOpen(false)}
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            <Plus weight="bold" />
            New post
          </Link>
          {NAV_SECTIONS.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="px-3 text-xs font-medium text-muted-foreground">{s.label}</p>
              {[...s.items, ...(s.more ?? [])].map(row)}
            </div>
          ))}
          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground">Account</p>
            {row({ label: "Billing", href: "/billing", icon: CreditCard })}
            {row({ label: "Settings", href: "/settings", icon: GearSix })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
