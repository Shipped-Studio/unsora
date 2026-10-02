"use client";

import { cn } from "@/lib/utils";
import { SHOWCASE_ITEMS } from "@/constant/onboarding";
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

const SHOWCASE_ICONS: Record<string, React.ElementType> = {
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

interface FeatureShowcaseStepProps {
  selectedTools: string[];
}

export function FeatureShowcaseStep({
  selectedTools,
}: FeatureShowcaseStepProps) {
  const items =
    selectedTools.length > 0
      ? SHOWCASE_ITEMS.filter((item) => selectedTools.includes(item.toolId))
      : SHOWCASE_ITEMS.slice(0, 4);

  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col items-center py-4 sm:py-8">
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Here&apos;s what Unsora can do for you
      </h1>
      <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
        Real capabilities from the platform — based on your selections.
      </p>

      <p className="mb-4 w-full text-xs font-bold tracking-widest text-muted-foreground">
        GENERATION
      </p>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item, i) => {
          const Icon = SHOWCASE_ICONS[item.toolId] ?? MonitorPlay;
          return (
            <div
              key={item.id}
              style={
                {
                  "--tw-animation-delay": `${i * 80}ms`,
                } as React.CSSProperties
              }
              className={cn(
                "animate-in fade-in zoom-in-95 fill-mode-both",
                "group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border transition-transform duration-300 hover:scale-[1.02]"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br",
                  item.gradient
                )}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-15">
                <Icon size={80} weight="thin" className="text-white" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

              {item.badge && (
                <span className="absolute right-3 top-3 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
                  {item.badge}
                </span>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <p className="text-base font-semibold text-white sm:text-lg">
                  {item.name}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
