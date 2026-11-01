"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  CalendarBlank,
  CreditCard,
  GearSix,
  NotePencil,
  Plugs,
  SignOut,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_SECTIONS } from "@/lib/navigation";

interface CommandMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const ctx = useContext(CommandMenuContext);
  if (!ctx) throw new Error("useCommandMenu must be used inside CommandMenuProvider");
  return ctx;
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandMenuContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandMenu open={open} onOpenChange={setOpen} />
    </CommandMenuContext.Provider>
  );
}

/**
 * Whole-word matching instead of cmdk's default fuzzy one, which scores
 * "subt" higher on "Accounts · Social accounts you can publish to" than on
 * "Subtitles". Label starts beat word starts beat anything else containing it.
 */
function rank(value: string, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return 1;
  const text = value.toLowerCase();
  if (text.startsWith(query)) return 1;
  if (text.split(/[\s·,/-]+/).some((word) => word.startsWith(query))) return 0.7;
  return text.includes(query) ? 0.4 : 0;
}

function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { signOut } = useClerk();

  const run = useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  const go = (href: string, external?: boolean) =>
    run(() => {
      if (external) window.open(href, "_blank", "noopener,noreferrer");
      else router.push(href);
    });

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Jump to a page or run an action"
      filter={rank}
    >
      <CommandInput placeholder="Search pages and actions" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/scheduler/new")}>
            <NotePencil />
            New post
          </CommandItem>
          <CommandItem onSelect={() => go("/scheduler/accounts")}>
            <Plugs />
            Connect a social account
          </CommandItem>
          <CommandItem onSelect={() => go("/files")}>
            <UploadSimple />
            Upload files
          </CommandItem>
        </CommandGroup>

        {NAV_SECTIONS.map((section) => (
          <CommandGroup key={section.label} heading={section.label}>
            {[...section.items, ...(section.more ?? [])].map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.description ?? ""}`}
                onSelect={() => go(item.href, item.external)}
              >
                <item.icon />
                {item.label}
                {item.description ? (
                  <span className="truncate text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />
        <CommandGroup heading="Calendar">
          {[
            { label: "Month view", view: "month", key: "M" },
            { label: "Week view", view: "week", key: "W" },
            { label: "Day view", view: "day", key: "D" },
            { label: "List view", view: "agenda", key: "L" },
          ].map((item) => (
            <CommandItem key={item.view} onSelect={() => go(`/scheduler/calendar?view=${item.view}`)}>
              <CalendarBlank />
              {item.label}
              <CommandShortcut>{item.key}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => go("/settings")}>
            <GearSix />
            Settings
          </CommandItem>
          <CommandItem onSelect={() => go("/billing")}>
            <CreditCard />
            Billing and credits
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => void signOut({ redirectUrl: "/sign-in" }))}
          >
            <SignOut />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
