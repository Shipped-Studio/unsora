"use client";

import { useEffect, type RefObject } from "react";

export function useCollapseExpandedOnMobile(
  isExpanded: boolean,
  onCollapse: () => void,
) {
  useEffect(() => {
    if (!isExpanded) return;

    const media = window.matchMedia("(max-width: 639px)");

    const handleChange = () => {
      if (media.matches) onCollapse();
    };

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [isExpanded, onCollapse]);
}

export function usePrefersReducedMotion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      node.style.setProperty(
        "transition-duration",
        media.matches ? "0ms" : "",
      );
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [ref]);
}
