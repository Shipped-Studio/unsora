"use client";

import { cn } from "@/lib/utils";
import { REFERRAL_SOURCES } from "@/constant/onboarding";
import {
  MagnifyingGlass,
  YoutubeLogo,
  XLogo,
  TiktokLogo,
  UsersThree,
  RedditLogo,
  InstagramLogo,
  DotsThreeCircle,
} from "@phosphor-icons/react";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  google: MagnifyingGlass,
  youtube: YoutubeLogo,
  twitter: XLogo,
  tiktok: TiktokLogo,
  friend: UsersThree,
  reddit: RedditLogo,
  instagram: InstagramLogo,
  other: DotsThreeCircle,
};

interface ReferralSourceStepProps {
  selected: string | null;
  onSelect: (id: string) => void;
}

export function ReferralSourceStep({
  selected,
  onSelect,
}: ReferralSourceStepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-8">
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Where did you hear about us?
      </h1>
      <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
        This helps us understand our community better.
      </p>

      <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {REFERRAL_SOURCES.map((source, i) => {
          const Icon = SOURCE_ICONS[source.id] ?? DotsThreeCircle;
          const isSelected = selected === source.id;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onSelect(source.id)}
              style={
                { "--tw-animation-delay": `${i * 50}ms` } as React.CSSProperties
              }
              className={cn(
                "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
                "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
                isSelected
                  ? "border-primary bg-accent ring-1 ring-primary"
                  : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm"
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon size={18} weight={isSelected ? "fill" : "regular"} />
              </div>
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {source.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
