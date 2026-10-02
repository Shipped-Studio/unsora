"use client";

import { cn } from "@/lib/utils";
import { TOOLS, type ToolCategory } from "@/constant/onboarding";
import {
  MonitorPlay,
  ImageSquare,
  Camera,
  UserCircle,
  PaintBrush,
  SmileySticker,
  Subtitles,
  ArrowsClockwise,
  Microphone,
} from "@phosphor-icons/react";

const TOOL_ICONS: Record<string, React.ElementType> = {
  "video-generator": MonitorPlay,
  "image-generator": ImageSquare,
  "ai-influencer": Camera,
  "ai-avatar": UserCircle,
  "motion-control": PaintBrush,
  "video-face-swap": SmileySticker,
  "subtitle-editor": Subtitles,
  "video-upscaler": ArrowsClockwise,
  "voice-changer": Microphone,
};

const CATEGORY_ORDER: ToolCategory[] = ["VIDEO", "AUDIO", "IMAGE"];

interface ToolInterestsStepProps {
  selected: string[];
  onToggle: (id: string) => void;
}

export function ToolInterestsStep({
  selected,
  onToggle,
}: ToolInterestsStepProps) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    tools: TOOLS.filter((t) => t.category === cat),
  }));

  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col items-center py-4 sm:py-8">
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        What do you want to create?
      </h1>
      <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
        Select all that interest you — we&apos;ll highlight these on your
        dashboard.
      </p>

      <div className="w-full space-y-6">
        {grouped.map((group, gi) => (
          <div key={group.category}>
            <p className="mb-3 text-xs font-bold tracking-widest text-muted-foreground">
              {group.category}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool, ti) => {
                const Icon = TOOL_ICONS[tool.id] ?? MonitorPlay;
                const isSelected = selected.includes(tool.id);
                const delay = gi * 80 + ti * 50;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => onToggle(tool.id)}
                    style={
                      {
                        "--tw-animation-delay": `${delay}ms`,
                      } as React.CSSProperties
                    }
                    className={cn(
                      "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
                      "relative flex flex-col items-center gap-2 rounded-xl border px-4 py-5 text-center transition-all duration-200",
                      isSelected
                        ? "border-primary bg-accent ring-1 ring-primary"
                        : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm"
                    )}
                  >
                    {tool.badge && (
                      <span
                        className={cn(
                          "absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold",
                          tool.badge === "NEW"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tool.badge}
                      </span>
                    )}
                    <div
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon
                        size={22}
                        weight={isSelected ? "fill" : "regular"}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-semibold transition-colors",
                          isSelected ? "text-foreground" : "text-foreground/80"
                        )}
                      >
                        {tool.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
