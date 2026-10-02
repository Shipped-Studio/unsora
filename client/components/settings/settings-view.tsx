"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { AppearanceSection } from "./appearance-section";
import { ProfileSection } from "./profile-section";
import { SchedulingSection } from "./scheduling-section";
import { SessionsSection } from "./sessions-section";
import { SignInSection } from "./sign-in-section";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", render: () => <ProfileSection /> },
  { id: "sign-in", label: "Sign-in", render: () => <SignInSection /> },
  { id: "scheduling", label: "Scheduling", render: () => <SchedulingSection /> },
  { id: "appearance", label: "Appearance", render: () => <AppearanceSection /> },
  { id: "sessions", label: "Sessions", render: () => <SessionsSection /> },
] as const;

const LINKS = [
  { label: "Billing", href: "/billing" },
  { label: "API keys", href: "/api-keys" },
  { label: "Agents", href: "/connect-agent" },
];

/** Settings with a section list on the left and one section at a time. */
export function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = SECTIONS.find((s) => s.id === searchParams.get("tab")) ?? SECTIONS[0];

  const itemClass = (active: boolean) =>
    cn(
      "flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-medium transition-colors",
      active
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <nav
        aria-label="Settings sections"
        className="flex shrink-0 gap-1 overflow-x-auto border-b p-3 no-scrollbar md:w-72 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-5"
      >
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={section.id === current.id ? "page" : undefined}
            onClick={() =>
              router.replace(`${pathname}?tab=${section.id}`, { scroll: false })
            }
            className={cn(itemClass(section.id === current.id), "w-auto shrink-0 md:w-full")}
          >
            {section.label}
          </button>
        ))}
        <div className="mx-2 my-2 hidden h-px bg-border md:block" />
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(itemClass(false), "w-auto shrink-0 justify-between md:w-full")}
          >
            {link.label}
            <ArrowSquareOut className="hidden size-4 md:block" />
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-8">
        <div className="max-w-3xl">{current.render()}</div>
      </div>
    </div>
  );
}
