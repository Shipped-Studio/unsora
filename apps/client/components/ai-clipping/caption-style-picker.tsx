"use client";

import { Prohibit } from "@phosphor-icons/react";
import {
  CAPTION_STYLE_GROUPS,
  getCaptionStylePreview,
} from "@/constant/caption-styles";
import { cn } from "@/lib/utils";

/** Same shape as the preview files (510x320 and 370x232). */
const TILE_MEDIA_CLASS =
  "relative flex aspect-[8/5] w-full items-center justify-center overflow-hidden rounded-lg bg-media";

const TILE_CLASS =
  "group/tile flex flex-col gap-1.5 rounded-xl p-1 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Caption choice as a grid of animated previews. "No captions" is the first
 * tile, so turning captions on and picking a look is a single click.
 */
export function CaptionStylePicker({
  enabled,
  styleId,
  onChange,
}: {
  enabled: boolean;
  styleId: string;
  onChange: (next: { enabled: boolean; styleId: string }) => void;
}) {
  return (
    <div className="max-h-[min(26rem,60svh)] overflow-y-auto p-2">
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          aria-pressed={!enabled}
          onClick={() => onChange({ enabled: false, styleId })}
          className={TILE_CLASS}
        >
          <span
            className={cn(
              TILE_MEDIA_CLASS,
              "bg-muted",
              !enabled && "ring-2 ring-primary",
            )}
          >
            <Prohibit className="size-5 text-muted-foreground" />
          </span>
          <span className="truncate px-0.5 text-xs">No captions</span>
        </button>
      </div>

      {CAPTION_STYLE_GROUPS.map((group) => (
        <section key={group.label} className="mt-3">
          <h3 className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">
            {group.label}
          </h3>
          <div className="grid grid-cols-3 gap-1">
            {group.styles.map((style) => {
              const selected = enabled && style.id === styleId;
              return (
                <button
                  key={style.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ enabled: true, styleId: style.id })}
                  className={TILE_CLASS}
                >
                  <span
                    className={cn(
                      TILE_MEDIA_CLASS,
                      selected && "ring-2 ring-primary",
                    )}
                  >
                    <img
                      src={getCaptionStylePreview(style.id)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-contain"
                    />
                  </span>
                  <span
                    className={cn(
                      "truncate px-0.5 text-xs",
                      selected ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {style.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
