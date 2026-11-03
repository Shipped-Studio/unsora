"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Check } from "@phosphor-icons/react";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { UNSORA_LOGO } from "@/constant/brand";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";

/*
 * A looping film of Unsora in a chat, in two scenes:
 *
 *   1. Schedule: attach a video, ask for it to go out tomorrow at 9am, and a
 *      post lands on TikTok, Instagram and YouTube.
 *   2. Clip: paste a long video, Unsora finds the best moments, cuts
 *      captioned vertical shorts, and each one is scheduled.
 *
 * The chat is symbolic (no real chat UI); the videos are real clips Unsora
 * made from SOURCE, served from public/connector/. One clock drives
 * everything, so the scene and the points beside it always agree.
 */

/** Typed after the Unsora tag; both read like the plugin-store examples. */
const SCHEDULE_PROMPT =
  "Use Unsora to schedule my latest video to TikTok, Instagram and YouTube for tomorrow at 9am.";
const CLIP_PROMPT = "Use Unsora to clip this YouTube video into 3 vertical shorts with captions:";

/** The long video the shorts were cut from. */
const SOURCE = "youtu.be/84dYijIpWjQ";
/** The finished video the first scene schedules. */
const POST_VIDEO = "/connector/clip-2";

/** Scene 1, in ms from the start of the loop. */
const S = { show: 300, type: 700, handoff: 3000, card: 3600, rows: 4400, fade: 7800 };
/** Scene 2 starts here; its beats are in ms from that point. */
const SCENE2 = 8400;
const C = { link: 300, type: 700, handoff: 2700, find: 3300, cut: 4700, post: 6300, fade: 9000 };
const END = SCENE2 + 9600;

const PLATFORMS = [
  { provider: "tiktok", name: "TikTok" },
  { provider: "instagram", name: "Instagram" },
  { provider: "google", name: "YouTube" },
];

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

/** True when the viewer asked for less motion; then the videos show stills. */
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

export type Beat = "schedule" | "clip" | "post";

/**
 * Milliseconds into the loop. Starts (and, with reduced motion, stays) on the
 * finished clipping frame, so the server render and still viewers see shorts
 * that are made and scheduled.
 */
export function useLoopClock() {
  const [t, setT] = useState(SCENE2 + C.fade - 1);
  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      setT((performance.now() - started) % END);
    }, 50);
    return () => window.clearInterval(timer);
  }, []);
  const beat: Beat = t < SCENE2 ? "schedule" : t < SCENE2 + C.post ? "clip" : "post";
  return { t, beat };
}

/** How much of `text` is typed `t` ms in, typing from `from` to `to`. */
function typedText(text: string, t: number, from: number, to: number) {
  const n = Math.floor(((t - from) / (to - from)) * text.length);
  return text.slice(0, Math.max(0, n));
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
  const still = usePrefersReducedMotion();
  const app = { appName, appLogoUrl, appIcon };
  const scene1 = t < SCENE2;
  return (
    <div
      aria-hidden
      className="relative isolate overflow-hidden rounded-2xl bg-stage p-5 text-stage-foreground ring-1 ring-stage-border sm:p-7"
    >
      <div className="pointer-events-none absolute -right-24 -bottom-32 -z-10 size-80 rounded-full bg-brand/10 blur-3xl" />
      {/* Both scenes share one cell, so the panel keeps the taller one's height. */}
      <div className="grid">
        <div className={cn("col-start-1 row-start-1", !scene1 && "invisible")}>
          <ScheduleScene t={t} still={still} {...app} />
        </div>
        <div className={cn("col-start-1 row-start-1", scene1 && "invisible")}>
          <ClipScene t={scene1 ? 0 : t - SCENE2} still={still} {...app} />
        </div>
      </div>
    </div>
  );
}

type SceneProps = {
  t: number;
  still: boolean;
  appName: string;
  appLogoUrl?: string | null;
  appIcon?: React.ComponentType<{ className?: string }>;
};

/** Scene 1: a finished video, scheduled to three platforms. */
function ScheduleScene({ t, still, ...app }: SceneProps) {
  const typing = t >= S.type && t < S.handoff;
  const status = t >= S.rows + 400 * PLATFORMS.length ? "Scheduled" : t >= S.card ? "Scheduling" : "Asking Unsora";
  return (
    <div className={cn("flex flex-col gap-6 transition-opacity duration-500", t >= S.fade && "opacity-0")}>
      <Ask visible={t >= S.show}>
        <span className="flex max-w-full items-center gap-2 rounded-xl bg-stage-card py-1.5 pr-3 pl-1.5 text-xs text-stage-muted ring-1 ring-stage-border">
          <img src={`${POST_VIDEO}.jpg`} alt="" className="h-8 w-[18px] shrink-0 rounded object-cover" />
          <span className="truncate">latest-video.mp4</span>
        </span>
        <Bubble text={typedText(SCHEDULE_PROMPT, t, S.type, S.handoff - 300)} typing={typing} />
      </Ask>

      <Handoff visible={t >= S.handoff} status={status} {...app} />

      {/* The post, with each platform ticking in */}
      <div
        className={cn(
          "flex gap-4 rounded-2xl border border-stage-border bg-stage-card p-3 transition-all duration-500 sm:p-4",
          t >= S.card ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <div className="aspect-9/16 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-stage-border sm:w-28">
          <ShortVideo src={POST_VIDEO} still={still} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <p className="mb-1 text-xs text-stage-muted">Tomorrow, 9:00 AM</p>
          {PLATFORMS.map((p, i) => {
            const on = t >= S.rows + 400 * i;
            return (
              <div
                key={p.provider}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border border-stage-border px-3 py-2 text-sm transition-all duration-300",
                  on ? "opacity-100" : "opacity-30",
                )}
              >
                <PlatformIcon provider={p.provider} className="size-5" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <Check
                  className={cn("size-3.5 text-brand transition-opacity", on ? "opacity-100" : "opacity-0")}
                  weight="bold"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Scene 2: a long video clipped into captioned shorts, each scheduled. */
function ClipScene({ t, still, ...app }: SceneProps) {
  const typing = t >= C.type && t < C.handoff;
  const status =
    t >= C.post ? "Scheduled" : t >= C.cut ? "Adding captions" : t >= C.find ? "Finding moments" : "Asking Unsora";
  return (
    <div className={cn("flex flex-col gap-6 transition-opacity duration-500", t >= C.fade && "opacity-0")}>
      <Ask visible={t >= C.link}>
        <Bubble text={typedText(CLIP_PROMPT, t, C.type, C.handoff - 300)} typing={typing} />
        <span
          className={cn(
            "flex max-w-full items-center gap-2 rounded-xl bg-stage-card px-3 py-2 text-xs text-stage-muted ring-1 ring-stage-border transition-opacity duration-300",
            t >= C.handoff - 300 ? "opacity-100" : "opacity-0",
          )}
        >
          <PlatformIcon provider="google" className="size-4" />
          <span className="truncate">{SOURCE}</span>
        </span>
      </Ask>

      <Handoff visible={t >= C.handoff} status={status} {...app} />

      {/* The long video, with the moments Unsora picks */}
      <div
        className={cn(
          "relative h-8 overflow-hidden rounded-lg bg-stage-card ring-1 ring-stage-border transition-opacity duration-500",
          t >= C.find ? "opacity-100" : "opacity-0",
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
              t >= C.find + 400 * (i + 1) ? "opacity-100" : "opacity-0",
            )}
            style={{ left: `${m.left}%`, width: `${m.width}%` }}
          />
        ))}
      </div>

      {/* Three captioned shorts, each scheduled */}
      <div className="grid grid-cols-3 gap-3">
        {CLIPS.map((clip, i) => {
          const cut = t >= C.cut + 250 * i;
          const posted = t >= C.post + 350 * i;
          return (
            <div
              key={clip.provider}
              className={cn(
                "flex flex-col items-center gap-2 transition-all duration-500",
                cut ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              <div className="relative aspect-9/16 w-full max-w-32 overflow-hidden rounded-xl bg-stage-card ring-1 ring-stage-border">
                <ShortVideo src={clip.src} still={still} />
                <span
                  className={cn(
                    "absolute top-2 left-2 transition-all duration-300",
                    posted ? "scale-100 opacity-100" : "scale-50 opacity-0",
                  )}
                >
                  <PlatformIcon provider={clip.provider} className="size-5 rounded-full ring-2 ring-stage/60" />
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
  );
}

/** The person's message, right-aligned like a chat. */
function Ask({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "flex max-w-[85%] flex-col items-end gap-2 transition-all duration-300",
          visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The request, led by the Unsora tag as in the plugin-store examples. */
function Bubble({ text, typing }: { text: string; typing: boolean }) {
  return (
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
      {text}
      {typing ? (
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-stage-foreground" />
      ) : null}
    </p>
  );
}

/** The app handing the request to Unsora, with what Unsora is doing. */
function Handoff({
  visible,
  status,
  appName,
  appLogoUrl,
  appIcon,
}: {
  visible: boolean;
  status: string;
  appName: string;
  appLogoUrl?: string | null;
  appIcon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <AppMark name={appName} logoUrl={appLogoUrl} icon={appIcon} size="sm" />
      <span className="relative h-px flex-1 overflow-hidden bg-stage-border">
        <span
          className={cn(
            "absolute inset-y-0 left-0 bg-brand transition-[width] duration-700 ease-out",
            visible ? "w-full" : "w-0",
          )}
        />
      </span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stage-card ring-1 ring-stage-border">
        {/* The stage is dark, so the light mark. */}
        <Image src={UNSORA_LOGO.logoLight} alt="" width={24} height={24} className="size-6" />
      </span>
      <span className="w-28 text-xs text-stage-muted">{status}</span>
    </div>
  );
}

/** A real short, muted and looping; a still frame with reduced motion. */
function ShortVideo({ src, still }: { src: string; still: boolean }) {
  return still ? (
    <img src={`${src}.jpg`} alt="" className="size-full object-cover" />
  ) : (
    <video
      src={`${src}.mp4`}
      poster={`${src}.jpg`}
      className="size-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}
