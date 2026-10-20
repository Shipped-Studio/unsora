/**
 * The B-rolls tab's timeline on screen: B-roll clips in their layouts,
 * transitions at cuts, widgets, the outro card and timeline sounds.
 *
 * Identical copies live in apps/client/components/subtitle-editor and
 * apps/remotion/src. Change both together.
 */
import React from "react";
import { Audio, Img, Sequence, useVideoConfig } from "remotion";
import {
  soundPath,
  soundVolume,
  transitionInfo,
  type BrollClip,
  type ClipLayout,
  WIDGET_DEFAULTS,
  type Timeline,
  type TimelineTransition,
  type TimelineWidget,
} from "./caption-style";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const pct = (n: number) => `${n}%`;

type Box = { left: number; top: number; width: number; height: number };
const FULL: Box = { left: 0, top: 0, width: 100, height: 100 };
const BORDER_INSET = 2;

interface Arrangement {
  /** Where the speaker's video goes; full frame when missing. */
  aroll?: Box;
  broll: Box;
  brollFit: "cover" | "contain";
  brollRadius?: string;
  arollRadius?: string;
  /** A white border round the parts, for the bordered splits. */
  bordered?: boolean;
  /** Dims the speaker behind a framed B-roll. */
  dimAroll?: boolean;
  square?: boolean;
}

/** Where the speaker and the B-roll sit for each of Submagic's layouts. */
export function arrangement(layout: ClipLayout): Arrangement {
  switch (layout) {
    case "cover":
      return { broll: FULL, brollFit: "cover" };
    case "contain":
      return { broll: FULL, brollFit: "contain" };
    case "rounded":
      return { broll: { left: 7, top: 18, width: 86, height: 64 }, brollFit: "cover", brollRadius: "4%", dimAroll: true };
    case "square":
      return { broll: { left: 7, top: 0, width: 86, height: 0 }, brollFit: "cover", brollRadius: "3%", dimAroll: true, square: true };
    case "split-50-50":
      return { broll: { left: 0, top: 0, width: 100, height: 50 }, aroll: { left: 0, top: 50, width: 100, height: 50 }, brollFit: "cover" };
    case "split-35-65":
      return { broll: { left: 0, top: 0, width: 100, height: 35 }, aroll: { left: 0, top: 35, width: 100, height: 65 }, brollFit: "cover" };
    case "split-50-50-bordered":
      return {
        broll: { left: BORDER_INSET, top: BORDER_INSET, width: 100 - 2 * BORDER_INSET, height: 50 - 1.5 * BORDER_INSET },
        aroll: { left: BORDER_INSET, top: 50 + BORDER_INSET / 2, width: 100 - 2 * BORDER_INSET, height: 50 - 1.5 * BORDER_INSET },
        brollFit: "cover", bordered: true, brollRadius: "1.5%", arollRadius: "1.5%",
      };
    case "split-35-65-bordered":
      return {
        broll: { left: BORDER_INSET, top: BORDER_INSET, width: 100 - 2 * BORDER_INSET, height: 35 - 1.5 * BORDER_INSET },
        aroll: { left: BORDER_INSET, top: 35 + BORDER_INSET / 2, width: 100 - 2 * BORDER_INSET, height: 65 - 1.5 * BORDER_INSET },
        brollFit: "cover", bordered: true, brollRadius: "1.5%", arollRadius: "1.5%",
      };
    case "green-screen-bottom-right":
      return { broll: FULL, aroll: { left: 56, top: 58, width: 40, height: 38 }, brollFit: "cover", arollRadius: "6%" };
    case "green-screen-center":
      return { broll: FULL, aroll: { left: 18, top: 46, width: 64, height: 50 }, brollFit: "cover", arollRadius: "6%" };
    case "small-video-top-right":
      return { broll: { left: 58, top: 5, width: 37, height: 24 }, brollFit: "cover", brollRadius: "6%" };
    case "small-video-bottom-right":
      return { broll: { left: 58, top: 70, width: 37, height: 24 }, brollFit: "cover", brollRadius: "6%" };
    case "portrait-small-video-top-right":
      return { broll: FULL, aroll: { left: 62, top: 5, width: 33, height: 28 }, brollFit: "cover", arollRadius: "6%" };
  }
}

export function activeClip(timeline: Timeline | undefined, time: number): BrollClip | undefined {
  return timeline?.brolls.find((clip) => time >= clip.start && time < clip.end);
}

const boxStyle = (box: Box): React.CSSProperties => ({
  position: "absolute",
  left: pct(box.left),
  top: pct(box.top),
  width: pct(box.width),
  height: pct(box.height),
  overflow: "hidden",
});

/** The speaker's box while a clip is on screen. */
export function arollStyle(clip: BrollClip | undefined): React.CSSProperties {
  if (!clip) return boxStyle(FULL);
  const a = arrangement(clip.layout);
  return {
    ...boxStyle(a.aroll ?? FULL),
    borderRadius: a.arollRadius,
    filter: a.dimAroll ? "brightness(0.45) blur(6px)" : undefined,
    boxShadow: a.aroll && a.arollRadius ? "0 0.6vmin 3vmin rgba(0,0,0,0.45)" : undefined,
    zIndex: a.aroll && !a.bordered && a.aroll.width < 100 ? 3 : 1,
  };
}

/**
 * The B-roll on screen at `time`. `VideoComponent` is the app's video
 * element: Video in the preview, OffthreadVideo in the export.
 */
export function BrollLayer({
  timeline,
  time,
  offset,
  motion,
  VideoComponent,
}: {
  timeline: Timeline | undefined;
  /** Seconds into the source video. */
  time: number;
  /** Seconds trimmed off the start of the source. */
  offset: number;
  /** A motion transition moving this clip in. */
  motion?: React.CSSProperties;
  VideoComponent: React.ComponentType<{
    src: string;
    muted?: boolean;
    style?: React.CSSProperties;
  }>;
}) {
  const { fps } = useVideoConfig();
  const clip = activeClip(timeline, time);
  if (!clip) return null;
  const a = arrangement(clip.layout);
  const since = time - clip.start;
  const length = clip.end - clip.start;
  // Stills drift slowly so they don't feel frozen.
  const drift = clip.kind === "image" ? 1 + 0.12 * clamp01(since / length) : 1;
  const media: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: a.brollFit,
    transform: drift !== 1 ? `scale(${drift.toFixed(4)})` : undefined,
    backgroundColor: a.brollFit === "contain" ? "#000" : undefined,
  };
  const box: React.CSSProperties = a.square
    ? {
        position: "absolute",
        left: pct(a.broll.left),
        width: pct(a.broll.width),
        aspectRatio: "1 / 1",
        top: "50%",
        transform: "translateY(-50%)",
        overflow: "hidden",
      }
    : boxStyle(a.broll);

  return (
    <div
      style={{
        ...box,
        ...motion,
        // A moving clip keeps its own place, e.g. a square's centring.
        transform: [box.transform, motion?.transform].filter(Boolean).join(" ") || undefined,
        borderRadius: a.brollRadius,
        zIndex: 2,
        boxShadow: a.brollRadius ? "0 0.6vmin 3vmin rgba(0,0,0,0.45)" : undefined,
        outline: a.bordered ? "0.4vmin solid #ffffff" : undefined,
      }}
    >
      {clip.kind === "video" ? (
        <Sequence from={Math.round((clip.start - offset) * fps)} layout="none">
          <VideoComponent src={clip.url} muted style={media} />
        </Sequence>
      ) : (
        <Img src={clip.url} style={media} />
      )}
    </div>
  );
}

function transitionAt(
  transitions: TimelineTransition[] | undefined,
  time: number,
  fps: number,
  kind: "motion" | "overlay",
) {
  for (const t of transitions ?? []) {
    const info = transitionInfo(t.id);
    if (info.kind !== kind || !info.frames) continue;
    const span = info.frames / fps;
    // Overlays peak on the cut; motions run from it.
    const from = kind === "overlay" ? t.at - span / 2 : t.at;
    if (time >= from && time < from + span) {
      return { id: t.id, at: t.at, p: (time - from) / span };
    }
  }
  return null;
}

/**
 * The motion transition running at `time`, if any: the cut it belongs to
 * and how the incoming clip moves in.
 */
export function activeMotion(
  transitions: TimelineTransition[] | undefined,
  time: number,
  fps: number,
): { at: number; style: React.CSSProperties } | null {
  const active = transitionAt(transitions, time, fps, "motion");
  if (!active) return null;
  return { at: active.at, style: transitionMotion(transitions, time, fps) };
}

/** How the incoming clip moves in at a motion transition. */
export function transitionMotion(
  transitions: TimelineTransition[] | undefined,
  time: number,
  fps: number,
): React.CSSProperties {
  const active = transitionAt(transitions, time, fps, "motion");
  if (!active) return {};
  const e = easeOutCubic(active.p);
  const blur = `blur(${(14 * (1 - e)).toFixed(2)}px)`;
  switch (active.id) {
    case "slide-blur-top":
      return { transform: `translateY(${(-100 * (1 - e)).toFixed(2)}%)`, filter: blur };
    case "slide-blur-bottom":
      return { transform: `translateY(${(100 * (1 - e)).toFixed(2)}%)`, filter: blur };
    case "slide-blur-left":
      return { transform: `translateX(${(-100 * (1 - e)).toFixed(2)}%)`, filter: blur };
    case "slide-blur-right":
      return { transform: `translateX(${(100 * (1 - e)).toFixed(2)}%)`, filter: blur };
    case "zoom-blur-in":
      return { transform: `scale(${(1.6 - 0.6 * e).toFixed(3)})`, filter: blur };
    case "zoom-blur-out":
      return { transform: `scale(${(0.6 + 0.4 * e).toFixed(3)})`, filter: blur };
    case "shake-blur": {
      const k = 1 - e;
      return {
        transform: `translate(${(6 * k * Math.sin(active.p * 40)).toFixed(2)}%, ${(4 * k * Math.cos(active.p * 33)).toFixed(2)}%) rotate(${(3 * k * Math.sin(active.p * 27)).toFixed(2)}deg)`,
        filter: blur,
      };
    }
    case "paper-tear": {
      // A ragged edge sweeps across, revealing the new picture.
      const x = 100 * (1 - easeInOut(active.p));
      const points = Array.from({ length: 13 }, (_, i) => {
        const y = (i / 12) * 100;
        const jag = i % 2 ? 3 : -3;
        return `${clampPct(x + jag)}% ${y}%`;
      });
      return { clipPath: `polygon(${clampPct(x)}% 0%, 100% 0%, 100% 100%, ${points.reverse().join(", ")})` };
    }
    default:
      return {};
  }
}

const clampPct = (n: number) => Math.min(100, Math.max(0, n)).toFixed(2);

/** Overlay transitions, drawn in place of Submagic's effect clips. */
export function TransitionOverlay({
  transitions,
  time,
}: {
  transitions: TimelineTransition[] | undefined;
  time: number;
}) {
  const { fps } = useVideoConfig();
  const active = transitionAt(transitions, time, fps, "overlay");
  if (!active) return null;
  const info = transitionInfo(active.id);
  const p = active.p;
  // Rises to the cut and falls away after it.
  const peak = Math.sin(Math.PI * p);
  const base: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 5,
    mixBlendMode: info.blend ?? "normal",
  };
  switch (active.id) {
    case "film-burn-2":
    case "fire-wipe": {
      const x = -40 + 180 * p;
      return (
        <div
          style={{
            ...base,
            background: `radial-gradient(ellipse 45% 120% at ${x}% 50%, rgba(255,200,80,${peak}) 0%, rgba(255,90,20,${0.9 * peak}) 35%, rgba(120,20,0,${0.6 * peak}) 60%, transparent 75%)`,
          }}
        />
      );
    }
    case "film-burn-3":
      return (
        <div
          style={{
            ...base,
            background: `radial-gradient(circle at 20% 30%, rgba(255,170,60,${peak}) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,80,30,${0.9 * peak}) 0%, transparent 50%), rgba(255,240,200,${0.35 * peak})`,
          }}
        />
      );
    case "photo-vintage":
      return (
        <div
          style={{
            ...base,
            background: `radial-gradient(circle, rgba(255,230,180,${0.5 * peak}) 0%, rgba(120,80,40,${0.6 * peak}) 100%)`,
          }}
        />
      );
    case "vhs":
      return (
        <div style={base}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: peak,
              background:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, transparent 2px, transparent 4px)",
            }}
          />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${(37 * (i + 1) + p * 90) % 100}%`,
                height: `${3 + i * 2}%`,
                background: ["rgba(255,0,80,0.5)", "rgba(0,200,255,0.5)", "rgba(255,255,255,0.4)"][i],
                opacity: peak,
              }}
            />
          ))}
        </div>
      );
    case "swipe-light": {
      const x = -60 + 220 * p;
      return (
        <div
          style={{
            ...base,
            background: `linear-gradient(110deg, transparent ${x - 25}%, rgba(255,255,255,${0.95 * peak}) ${x}%, transparent ${x + 25}%)`,
          }}
        />
      );
    }
    case "light-leak":
      return (
        <div
          style={{
            ...base,
            background: `radial-gradient(ellipse 60% 80% at ${10 + 30 * p}% 20%, rgba(255,150,60,${0.85 * peak}) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at ${90 - 20 * p}% 80%, rgba(255,60,120,${0.6 * peak}) 0%, transparent 70%)`,
          }}
        />
      );
    case "glitch":
    case "glitch-2": {
      const frame = Math.floor(p * 12);
      return (
        <div style={base}>
          {Array.from({ length: 7 }, (_, i) => {
            const seed = Math.abs(Math.sin((i + 1) * 91.7 + frame * 13.3));
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(seed * 30).toFixed(1)}%`,
                  right: `${((1 - seed) * 20).toFixed(1)}%`,
                  top: `${((seed * 977) % 100).toFixed(1)}%`,
                  height: `${(2 + seed * 6).toFixed(1)}%`,
                  background: i % 2 ? "rgba(0,255,200,0.7)" : "rgba(255,0,90,0.7)",
                  opacity: peak,
                }}
              />
            );
          })}
        </div>
      );
    }
    case "paper-slide": {
      const x = -100 + 200 * easeInOut(p);
      return (
        <div
          style={{
            ...base,
            transform: `translateX(${x}%)`,
            background: "linear-gradient(90deg, #efe6d2, #fbf6ea 50%, #e8dcc2)",
          }}
        />
      );
    }
    case "comic":
      return (
        <div
          style={{
            ...base,
            opacity: peak,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0 18%, transparent 19%) 0 0 / 6% 6%, radial-gradient(circle at 50% 50%, rgba(255,220,0,0.9) 0%, rgba(255,80,0,0.7) 45%, transparent 70%)",
          }}
        />
      );
    case "drawer": {
      const x = -100 + 200 * easeInOut(p);
      return (
        <div
          style={{
            ...base,
            transform: `translateX(${x}%)`,
            background: "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.6), rgba(255,255,255,0.08))",
          }}
        />
      );
    }
    default:
      return null;
  }
}

// Icons for the call-to-action styles, as inline SVG so the export needs no font.
const CTA_ICONS: Record<NonNullable<TimelineWidget["style"]>, string> = {
  link: "M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5",
  message: "M4 5h16v11H8l-4 4z",
  comment: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z",
  subscribe: "M15 17H9a3 3 0 0 0 6 0zM18 16V11a6 6 0 0 0-12 0v5l-2 2h16z",
};

/** Speaker name tags and calls to action. */
export function WidgetsLayer({
  timeline,
  time,
  frameWidth,
  fontFamily,
}: {
  timeline: Timeline | undefined;
  time: number;
  frameWidth: number;
  fontFamily: string;
}) {
  const widgets = timeline?.widgets.filter((w) => time >= w.start && time < w.end) ?? [];
  return (
    <>
      {widgets.map((widget) => {
        const since = time - widget.start;
        const until = widget.end - time;
        const p = easeOutCubic(clamp01(since / 0.35)) * clamp01(until / 0.25);
        const defaults = WIDGET_DEFAULTS[widget.kind];
        const unit = (frameWidth / 100) * ((widget.size ?? defaults.size) / 70);
        const place: React.CSSProperties = {
          position: "absolute",
          left: pct(widget.x ?? defaults.x),
          top: pct(widget.y ?? defaults.y),
          zIndex: 15,
          opacity: p,
          fontFamily,
          whiteSpace: "nowrap",
        };
        if (widget.kind === "speaker") {
          return (
            <div
              key={widget.id}
              data-drag-target={`widget:${widget.id}`}
              style={{
                ...place,
                transform: `translate(-50%, -50%) translateX(${(-8 * (1 - p)).toFixed(2)}%)`,
                background: "rgba(0,0,0,0.72)",
                borderLeft: `${0.8 * unit}px solid #3F83F8`,
                borderRadius: unit,
                padding: `${1.6 * unit}px ${3 * unit}px`,
                color: "#ffffff",
              }}
            >
              <div style={{ fontSize: 4.4 * unit, fontWeight: 700, lineHeight: 1.15 }}>{widget.title}</div>
              {widget.subtitle ? (
                <div style={{ fontSize: 3.2 * unit, opacity: 0.8, lineHeight: 1.2 }}>{widget.subtitle}</div>
              ) : null}
            </div>
          );
        }
        const style = widget.style ?? "link";
        const subscribe = style === "subscribe";
        return (
          <div
            key={widget.id}
            data-drag-target={`widget:${widget.id}`}
            style={{
              ...place,
              transform: `translate(-50%, -50%) scale(${(0.7 + 0.3 * p).toFixed(3)})`,
              display: "flex",
              alignItems: "center",
              gap: 2 * unit,
              background: subscribe ? "#ff0033" : "#ffffff",
              color: subscribe ? "#ffffff" : "#111111",
              borderRadius: style === "message" || style === "comment" ? 3 * unit : 9999,
              padding: `${2.2 * unit}px ${4.5 * unit}px`,
              boxShadow: `0 ${unit}px ${4 * unit}px rgba(0,0,0,0.35)`,
              fontSize: 4.6 * unit,
              fontWeight: 800,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={5.5 * unit}
              height={5.5 * unit}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={CTA_ICONS[style]} />
            </svg>
            {widget.title}
          </div>
        );
      })}
    </>
  );
}

/** The end card, after the video. `since` is seconds into the outro. */
export function OutroCard({
  outro,
  since,
  frameWidth,
  fontFamily,
}: {
  outro: NonNullable<Timeline["outro"]>;
  since: number;
  frameWidth: number;
  fontFamily: string;
}) {
  const unit = frameWidth / 100;
  const p = easeOutCubic(clamp01(since / 0.5));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2 * unit,
        background: "#0b0b0c",
        opacity: clamp01(since / 0.25),
        fontFamily,
        color: "#ffffff",
        textAlign: "center",
        padding: 8 * unit,
      }}
    >
      <div
        style={{
          fontSize: 8 * unit,
          fontWeight: 800,
          lineHeight: 1.1,
          transform: `translateY(${(4 * (1 - p)).toFixed(2)}%)`,
        }}
      >
        {outro.title}
      </div>
      {outro.subtitle ? (
        <div style={{ fontSize: 4.4 * unit, opacity: 0.75 * p }}>{outro.subtitle}</div>
      ) : null}
    </div>
  );
}

/** Sounds on the timeline, and the ones transitions play. */
export function TimelineSounds({
  timeline,
  offset,
  soundUrl,
}: {
  timeline: Timeline | undefined;
  /** Seconds trimmed off the start, to move sounds onto the output timeline. */
  offset: number;
  soundUrl: (path: string) => string;
}) {
  const { fps } = useVideoConfig();
  const cues = [
    ...(timeline?.sounds ?? []).map((s) => ({ start: s.start, sound: s.sound, volume: s.volume })),
    ...(timeline?.transitions ?? []).flatMap((t) => {
      const info = transitionInfo(t.id);
      return info.sound && info.frames
        ? [{ start: t.at - (info.kind === "overlay" ? info.frames / fps / 2 : 0), sound: info.sound, volume: undefined }]
        : [];
    }),
  ].filter((cue) => cue.start - offset >= 0);
  return (
    <>
      {cues.map((cue, i) => (
        <Sequence
          key={`${i}-${cue.start}`}
          from={Math.round((cue.start - offset) * fps)}
          durationInFrames={Math.round(3.5 * fps)}
          layout="none"
        >
          <Audio
            src={soundUrl(soundPath(cue.sound))}
            volume={cue.volume ?? soundVolume(cue.sound)}
          />
        </Sequence>
      ))}
    </>
  );
}
