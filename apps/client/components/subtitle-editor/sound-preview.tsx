"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import {
  soundPath,
  soundVolume,
  type TransitionSound,
  type WordSound,
} from "@/components/subtitle-editor/caption-style";
import { cn } from "@/lib/utils";

type SoundId = WordSound | TransitionSound;

// One sound at a time: starting another stops the last.
let current: { id: SoundId; audio: HTMLAudioElement } | null = null;
const listeners = new Set<(id: SoundId | null) => void>();
const notify = () => listeners.forEach((listen) => listen(current?.id ?? null));

export function stopSound() {
  current?.audio.pause();
  current = null;
  notify();
}

/** Plays a sound effect at the level it plays at in the video. */
export function playSound(id: SoundId) {
  stopSound();
  const audio = new Audio(`/${soundPath(id)}`);
  audio.volume = soundVolume(id);
  audio.addEventListener("ended", () => {
    if (current?.audio === audio) stopSound();
  });
  current = { id, audio };
  notify();
  void audio.play().catch(stopSound);
}

function usePlaying() {
  const [playing, setPlaying] = useState<SoundId | null>(current?.id ?? null);
  useEffect(() => {
    listeners.add(setPlaying);
    return () => {
      listeners.delete(setPlaying);
    };
  }, []);
  return playing;
}

/** A small play/stop button for one sound; it never selects anything. */
export function SoundPlayButton({
  id,
  label,
  className,
}: {
  id: SoundId;
  label: string;
  className?: string;
}) {
  const playing = usePlaying() === id;
  return (
    <button
      type="button"
      aria-label={playing ? `Stop ${label}` : `Play ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        // Inside menu items: play without picking the item or closing the menu.
        event.preventDefault();
        event.stopPropagation();
        if (playing) stopSound();
        else playSound(id);
      }}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5",
        playing && "text-primary",
        className,
      )}
    >
      {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
    </button>
  );
}
