"use client";

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Player, Thumbnail } from "@remotion/player";
import {
  transitionInfo,
  type TransitionId,
} from "@/components/subtitle-editor/caption-style";
import {
  TransitionOverlay,
  activeMotion,
} from "@/components/subtitle-editor/timeline-layer";

const FPS = 30;
const DURATION = 54;
// The cut, a little in so the outgoing shot is seen first.
const CUT_FRAME = 18;
const WIDTH = 180;
const HEIGHT = 320;

/** Two made-up shots, so the cut between them is easy to see. */
function Shot({ variant }: { variant: "a" | "b" }) {
  const a = variant === "a";
  return (
    <AbsoluteFill
      style={{
        background: a
          ? "linear-gradient(165deg, #1e3a8a 0%, #0ea5e9 70%, #a5f3fc 100%)"
          : "linear-gradient(165deg, #7c2d12 0%, #f97316 55%, #fde68a 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: a ? 70 : 90,
          height: a ? 70 : 90,
          borderRadius: a ? "50%" : 18,
          background: a ? "rgba(255,255,255,0.85)" : "rgba(17,24,39,0.75)",
          transform: a ? "translateY(-30px)" : "rotate(12deg) translateY(20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 22,
          font: "700 22px system-ui, sans-serif",
          color: "#ffffff",
          textShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        {a ? "Shot A" : "Shot B"}
      </div>
    </AbsoluteFill>
  );
}

/** Shot A cuts to shot B with the transition, drawn as the export draws it. */
function TransitionScene({ id }: { id: TransitionId }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const at = CUT_FRAME / fps;
  const transitions = id === "none" ? [] : [{ at, id }];
  const motion = activeMotion(transitions, time, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <Shot variant="a" />
      {frame >= CUT_FRAME ? (
        <AbsoluteFill style={motion?.style}>
          <Shot variant="b" />
        </AbsoluteFill>
      ) : null}
      <TransitionOverlay transitions={transitions} time={time} />
    </AbsoluteFill>
  );
}

/** The frame that best shows a transition, for its tile. */
function stillFrame(id: TransitionId): number {
  const info = transitionInfo(id);
  if (!info.frames) return CUT_FRAME + 6;
  return info.kind === "overlay"
    ? CUT_FRAME
    : CUT_FRAME + Math.round(info.frames * 0.45);
}

export function TransitionThumbnail({ id }: { id: TransitionId }) {
  return (
    <Thumbnail
      component={TransitionScene}
      inputProps={{ id }}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      frameToDisplay={stillFrame(id)}
      durationInFrames={DURATION}
      fps={FPS}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** The transition playing on a loop. */
export function TransitionPlayer({ id }: { id: TransitionId }) {
  return (
    <Player
      key={id}
      component={TransitionScene}
      inputProps={{ id }}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      durationInFrames={DURATION}
      fps={FPS}
      autoPlay
      loop
      acknowledgeRemotionLicense
      style={{ width: "100%", height: "100%" }}
    />
  );
}
