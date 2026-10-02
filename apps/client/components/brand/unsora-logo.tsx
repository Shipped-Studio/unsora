"use client";

import Image from "next/image";
import { UNSORA_LOGO } from "@/constant/brand";
import { cn } from "@/lib/utils";

type UnsoraLogoVariant = "icon" | "full" | "mark";

interface UnsoraLogoProps {
  variant?: UnsoraLogoVariant;
  className?: string;
  priority?: boolean;
}

export function UnsoraLogo({
  variant = "full",
  className,
  priority = false,
}: UnsoraLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={UNSORA_LOGO.mark}
        alt="Unsora"
        width={32}
        height={32}
        priority={priority}
        className={cn("size-8 object-contain", className)}
      />
    );
  }

  const isIcon = variant === "icon";
  const darkSrc = isIcon ? UNSORA_LOGO.logoLight : UNSORA_LOGO.withText.dark;
  const lightSrc = isIcon ? UNSORA_LOGO.logoDark : UNSORA_LOGO.withText.light;
  const width = isIcon ? 32 : 160;
  const height = isIcon ? 32 : 40;
  const sizeClass = isIcon ? "size-8" : "h-8 w-auto";

  return (
    <>
      <Image
        src={darkSrc}
        alt="Unsora"
        width={width}
        height={height}
        priority={priority}
        className={cn(
          "hidden h-auto w-auto object-contain dark:block",
          sizeClass,
          className,
        )}
      />
      <Image
        src={lightSrc}
        alt="Unsora"
        width={width}
        height={height}
        priority={priority}
        className={cn(
          "block h-auto w-auto object-contain dark:hidden",
          sizeClass,
          className,
        )}
      />
    </>
  );
}
