"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: { box: "size-6 rounded-full", img: "size-4", text: "text-2xs" },
  sm: { box: "size-10 rounded-xl", img: "size-6", text: "text-base" },
  lg: { box: "size-14 rounded-2xl", img: "size-8", text: "text-xl" },
} as const;

/**
 * The connecting app's logo, from its Clerk OAuth application, or a known
 * app's icon. Without either (or when the logo fails to load) it falls back
 * to the app's initial on an ink tile, which still reads as a deliberate
 * mark next to Unsora's.
 */
export function AppMark({
  name,
  logoUrl,
  icon: Icon,
  size = "lg",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const s = SIZES[size];
  const showLogo = (Boolean(logoUrl) && !broken) || Boolean(Icon);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        s.box,
        showLogo ? "bg-card text-card-foreground ring-1 ring-border" : "bg-foreground text-background",
        className,
      )}
    >
      {Icon ? (
        <Icon className={s.img} />
      ) : showLogo ? (
        // Arbitrary client-registered host, so next/image's remote allowlist can't cover it.
        <img
          src={logoUrl ?? undefined}
          alt=""
          className={cn("object-contain", s.img)}
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden className={cn("font-display font-bold", s.text)}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
