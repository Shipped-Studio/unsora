"use client";

import { useLayoutEffect, type RefObject } from "react";

const GAP_PX = 8;

function measureDockOffset(node: HTMLElement): number {
  const rect = node.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return Math.max(0, viewportHeight - rect.top + GAP_PX);
}

function setDockHeight(value: number) {
  document.documentElement.style.setProperty(
    "--music-player-height",
    `${Math.ceil(value)}px`,
  );
}

export function useMusicPlayerDockHeight(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useLayoutEffect(() => {
    if (!active) {
      setDockHeight(0);
      return;
    }

    let frame = 0;
    let observer: ResizeObserver | null = null;

    const update = () => {
      const node = ref.current;
      if (!node) return;
      setDockHeight(measureDockOffset(node));
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    const attach = () => {
      const node = ref.current;
      if (!node) {
        frame = requestAnimationFrame(attach);
        return;
      }

      update();
      observer = new ResizeObserver(scheduleUpdate);
      observer.observe(node);
      window.addEventListener("resize", scheduleUpdate);
      window.addEventListener("orientationchange", scheduleUpdate);
      window.visualViewport?.addEventListener("resize", scheduleUpdate);
      window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    };

    attach();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      setDockHeight(0);
    };
  }, [active, ref]);
}
