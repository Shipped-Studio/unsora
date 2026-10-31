"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Check } from "@phosphor-icons/react";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { UNSORA_LOGO } from "@/constant/brand";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";

/*
 * A looping film of what Unsora does in a chat: paste a long video, Unsora
 * finds the best moments, cuts captioned vertical shorts, and they land on
 * the schedule. The chat is symbolic (no real chat UI); the three shorts are
 * real clips Unsora made from SOURCE, served from public/connector/. One
 * clock drives everything, so the scene and the points beside it agree.
 */

/** Typed after the Unsora tag; the wording of the plugin-store example. */
const PROMPT = "Use Unsora to clip this YouTube video into 3 vertical shorts with captions:";

/** The long video the three shorts below were cut from. */
const SOURCE = "youtu.be/84dYijIpWjQ";

/** Beat boundaries in ms within one loop. */
const T = { link: 300, type: 900, handoff: 2700, find: 3300, cut: 4700, post: 6300, fade: 9000, end: 9600 };

/** Where the three moments sit in the source video, as % of its length. */
const MOMENTS = [
  { left: 12, width: 11 },
  { left: 44, width: 9 },
  { left: 73, width: 12 },
];
const CLIPS = [
  { provider: "tiktok", when: "Tue 9:00", src: "/connector/clip-1" },
  { provider: "instagram", when: "Wed 9:00", src: "/connector/clip-2" },
  { provider: "google", when: "Thu 9:00", src: "/connector/clip-3" },
];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** True when the viewer asked for less motion; then the shorts show stills. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

export type Beat = "ask" | "make" | "post";

/**
 * Milliseconds into the loop. Starts (and, with reduced motion, stays) on the
 * finished frame, so the server render and still viewers see the whole story.
 */
export function useLoopClock() {
  const [t, setT] = useState(T.fade - 1);
  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      setT((performance.now() - started) % T.end);
    }, 50);
    return () => window.clearInterval(timer);
  }, []);
  const beat: Beat = t < T.handoff ? "ask" : t < T.post ? "make" : "post";
  return { t, beat };
}

export function HowItWorksLoop({
  appName,
  appLogoUrl,
  appIcon,
  t,
}: {
  appName: string;
  appLogoUrl?: string | null;
  appIcon?: React.ComponentType<{ className?: string }>;
  t: number;
}) {
  const typedLength = Math.floor(((t - T.type) / (T.handoff - T.type - 300)) * PROMPT.length);
  const typed = PROMPT.slice(0, Math.max(0, typedLength));
  const fading = t >= T.fade;
  const stillFrames = usePrefersReducedMotion();
  const status =
    t >= T.post ? "Scheduled" : t >= T.cut ? "Adding captions" : t >= T.find ? "Finding moments" : "Asking Unsora";

  return (
    <div
      aria-hidden
      className="relative isolate flex w-full flex-col gap-6 overflow-hidden rounded-2xl bg-stage p-5 text-stage-foreground ring-1 ring-stage-border sm:p-7"
    >
      <div className="pointer-events-none absolute -right-24 -bottom-32 -z-10 size-80 rounded-full bg-brand/10 blur-3xl" />

      <div className={cn("flex flex-col gap-6 transition-opacity duration-500", fading && "opacity-0")}>
        {/* 1 · You paste a link and ask */}
        <div className="flex items-start justify-end gap-2.5">
          <div
            className={cn(
              "flex max-w-[85%] flex-col items-end gap-2 transition-all duration-300",
              t < T.link ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
            )}
          >
            {/* Reads like the example prompts in Unsora's plugin-store listing:
                the app tile and its name, the request, then the link. */}
            <p className="min-h-10 rounded-2xl rounded-tr-md bg-stage-card px-4 py-2.5 text-sm leading-relaxed ring-1 ring-stage-border">
              <span className="mr-1.5 inline-flex translate-y-0.5 items-center gap-1.5 align-baseline font-medium text-chart-2">
                <Image
                  src="/brand/icon-tile-180.png"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 rounded-[4px] ring-1 ring-stage-border"
                />
                Unsora
              </span>
              {typed}
              {t >= T.type && t < T.handoff ? (
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-stage-foreground" />
              ) : null}
            </p>
            <span
              className={cn(
                "flex max-w-full items-center gap-2 rounded-xl bg-stage-card px-3 py-2 text-xs text-stage-muted ring-1 ring-stage-border transition-opacity duration-300",
                t >= T.handoff - 300 ? "opacity-100" : "opacity-0",
              )}
            >
              <PlatformIcon provider="google" className="size-4" />
              <span className="truncate">{SOURCE}</span>
            </span>
          </div>
        </div>

        {/* 2 · The app hands it to Unsora */}
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-500",
            t >= T.handoff ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <AppMark name={appName} logoUrl={appLogoUrl} icon={appIcon} size="sm" />
          <span className="relative h-px flex-1 overflow-hidden bg-stage-border">
            <span
              className={cn(
                "absolute inset-y-0 left-0 bg-brand transition-[width] duration-700 ease-out",
                t >= T.handoff ? "w-full" : "w-0",
              )}
            />
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stage-card ring-1 ring-stage-border">
            {/* The stage is dark, so the light mark. */}
            <Image src={UNSORA_LOGO.logoLight} alt="" width={24} height={24} className="size-6" />
          </span>
          <span className="w-28 text-xs text-stage-muted">{status}</span>
        </div>

        {/* 3 · The long video, with the moments Unsora picks */}
        <div
          className={cn(
            "relative h-8 overflow-hidden rounded-lg bg-stage-card ring-1 ring-stage-border transition-opacity duration-500",
            t >= T.find ? "opacity-100" : "opacity-0",
          )}
        >
          {/* Waveform-ish texture of the source video. */}
          <div className="absolute inset-0 flex items-center gap-[3px] px-2">
            {Array.from({ length: 64 }).map((_, i) => (
              <span
                key={i}
                className="w-full rounded-full bg-stage-foreground/15"
                style={{ height: `${25 + ((i * 37) % 55)}%` }}
              />
            ))}
          </div>
          {MOMENTS.map((m, i) => (
            <span
              key={i}
              className={cn(
                "absolute inset-y-0 rounded-md bg-brand/35 ring-1 ring-brand transition-opacity duration-300",
                t >= T.find + 400 * (i + 1) ? "opacity-100" : "opacity-0",
              )}
              style={{ left: `${m.left}%`, width: `${m.width}%` }}
            />
          ))}
        </div>

        {/* 4 · Three captioned shorts, each scheduled */}
        <div className="grid grid-cols-3 gap-3">
          {CLIPS.map((clip, i) => {
            const cut = t >= T.cut + 250 * i;
            const posted = t >= T.post + 350 * i;
            return (
              <div
                key={clip.provider}
                className={cn(
                  "flex flex-col items-center gap-2 transition-all duration-500",
                  cut ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                )}
              >
                <div className="relative aspect-9/16 w-full max-w-32 overflow-hidden rounded-xl bg-stage-card ring-1 ring-stage-border">
                  {/* A real short, muted and looping. Still frame only with reduced motion. */}
                  {stillFrames ? (
                    <img src={`${clip.src}.jpg`} alt="" className="size-full object-cover" />
                  ) : (
                    <video
                      src={`${clip.src}.mp4`}
                      poster={`${clip.src}.jpg`}
                      className="size-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  )}
                  <span
                    className={cn(
                      "absolute top-2 left-2 transition-all duration-300",
                      posted ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                  >
                    <PlatformIcon provider={clip.provider} className="size-5 ring-2 ring-stage/60 rounded-full" />
                  </span>
                </div>
                <span
                  className={cn(
                    "flex items-center gap-1 text-2xs text-stage-muted tabular-nums transition-opacity duration-300",
                    posted ? "opacity-100" : "opacity-0",
                  )}
                >
                  <Check className="size-3 text-brand" weight="bold" />
                  {clip.when}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
