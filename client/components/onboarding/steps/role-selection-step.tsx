"use client";

import { cn } from "@/lib/utils";
import { ROLES } from "@/constant/onboarding";
import {
  VideoCamera,
  Megaphone,
  FilmStrip,
  Buildings,
  Compass,
  Code,
} from "@phosphor-icons/react";

const ROLE_ICONS: Record<string, React.ElementType> = {
  "content-creator": VideoCamera,
  marketer: Megaphone,
  filmmaker: FilmStrip,
  business: Buildings,
  hobbyist: Compass,
  developer: Code,
};

interface RoleSelectionStepProps {
  selected: string[];
  onToggle: (id: string) => void;
}

export function RoleSelectionStep({
  selected,
  onToggle,
}: RoleSelectionStepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-8">
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        What best describes your role
        <br className="hidden sm:block" />
        {" "}or intended use?
      </h1>
      <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
        Select all that interest you — we&apos;ll highlight these on your dashboard.
      </p>

      <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map((role, i) => {
          const Icon = ROLE_ICONS[role.id] ?? Code;
          const isSelected = selected.includes(role.id);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onToggle(role.id)}
              style={{ "--tw-animation-delay": `${i * 50}ms` } as React.CSSProperties}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
                "flex items-center gap-3 rounded-xl border px-4 py-4 text-left transition-all duration-200",
                isSelected
                  ? "border-primary bg-accent ring-1 ring-primary"
                  : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm"
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon size={20} weight={isSelected ? "fill" : "regular"} />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold transition-colors",
                    isSelected ? "text-foreground" : "text-foreground/80"
                  )}
                >
                  {role.label}
                </p>
                <p className="text-xs text-muted-foreground">{role.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
