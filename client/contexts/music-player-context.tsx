"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MusicPlayerOverlay } from "@/components/music-generator/music-player-overlay";
import { getCdnUrl } from "@/lib/video-utils";
import { type MusicPlayerView } from "@/lib/layout-classes";
import { cn } from "@/lib/utils";

export interface MusicTrack {
  id: string;
  title: string;
  subtitle?: string;
  audioUrl: string;
  lyrics?: string;
}

interface MusicPlayerContextValue {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  playerView: MusicPlayerView;
  playbackError: string | null;
  play: (track: MusicTrack) => void;
  toggle: () => void;
  pause: () => void;
  seek: (time: number) => void;
  stop: () => void;
  retryPlay: () => void;
  setPlayerView: (view: MusicPlayerView) => void;
  minimizePlayer: () => void;
  expandPlayer: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

async function tryPlay(audio: HTMLAudioElement) {
  await audio.play();
}

function getPlaybackErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Tap play to start audio in your browser.";
    }
    if (error.name === "AbortError") {
      return "Playback was interrupted. Tap play to continue.";
    }
  }
  return "Could not play this track. Check your connection and try again.";
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = useRef(false);
  const trackIdRef = useRef<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerView, setPlayerView] = useState<MusicPlayerView>("mini");
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const runPlay = useCallback(async (audio: HTMLAudioElement) => {
    setIsBuffering(true);
    setPlaybackError(null);
    try {
      await tryPlay(audio);
    } catch (error) {
      setPlaybackError(getPlaybackErrorMessage(error));
      setIsPlaying(false);
    } finally {
      setIsBuffering(false);
    }
  }, []);

  const play = useCallback(
    (track: MusicTrack) => {
      if (!track.audioUrl?.trim()) {
        setPlaybackError("This track has no audio file yet.");
        return;
      }

      const audio = audioRef.current;
      if (audio && trackIdRef.current === track.id) {
        void runPlay(audio);
        setPlayerView((view) => (view === "minimized" ? "mini" : view));
        return;
      }

      pendingPlayRef.current = true;
      setPlaybackError(null);
      setCurrentTime(0);
      setDuration(0);
      setCurrentTrack(track);
      setPlayerView("mini");
    },
    [runPlay],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (audio.paused) {
      void runPlay(audio);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack, runPlay]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(time)) return;

      const maxTime =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : duration;
      const nextTime = Math.max(0, maxTime > 0 ? Math.min(time, maxTime) : time);

      if (Number.isFinite(maxTime) && maxTime > 0) {
        audio.currentTime = nextTime;
      }
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }
    pendingPlayRef.current = false;
    trackIdRef.current = null;
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
    setPlayerView("mini");
  }, []);

  const retryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    void runPlay(audio);
  }, [currentTrack, runPlay]);

  const minimizePlayer = useCallback(() => {
    setPlayerView("minimized");
  }, []);

  const expandPlayer = useCallback(() => {
    setPlayerView("expanded");
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onDurationChange = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setIsPlaying(true);
      setPlaybackError(null);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlaying = () => setIsBuffering(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      setPlaybackError("Audio failed to load. Try another track or refresh.");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    trackIdRef.current = currentTrack.id;
    audio.src = getCdnUrl(currentTrack.audioUrl);
    audio.load();

    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      void runPlay(audio);
    }
  }, [currentTrack, runPlay]);

  useEffect(() => {
    if (!currentTrack || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || "Untitled song",
      artist: currentTrack.subtitle || "Unsora",
    });

    const handlePlay = () => toggle();
    const handlePause = () => pause();
    const handleStop = () => stop();
    const handleSeek = (details: MediaSessionActionDetails) => {
      if (typeof details.seekTime === "number") seek(details.seekTime);
    };

    navigator.mediaSession.setActionHandler("play", handlePlay);
    navigator.mediaSession.setActionHandler("pause", handlePause);
    navigator.mediaSession.setActionHandler("stop", handleStop);
    navigator.mediaSession.setActionHandler("seekto", handleSeek);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.setActionHandler("seekto", null);
      navigator.mediaSession.metadata = null;
    };
  }, [currentTrack, pause, seek, stop, toggle]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const value = useMemo(
    () => ({
      currentTrack,
      isPlaying,
      isBuffering,
      currentTime,
      duration,
      playerView,
      playbackError,
      play,
      toggle,
      pause,
      seek,
      stop,
      retryPlay,
      setPlayerView,
      minimizePlayer,
      expandPlayer,
    }),
    [
      currentTrack,
      isPlaying,
      isBuffering,
      currentTime,
      duration,
      playerView,
      playbackError,
      play,
      toggle,
      pause,
      seek,
      stop,
      retryPlay,
      minimizePlayer,
      expandPlayer,
    ],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          currentTrack &&
            "pb-[calc(var(--music-player-height,0px)+max(1rem,env(safe-area-inset-bottom,0px)))]",
        )}
      >
        {children}
      </div>
      <audio ref={audioRef} preload="metadata" className="hidden" playsInline />
      {currentTrack && <MusicPlayerOverlay />}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  }
  return context;
}

export function useMusicPlayerOptional() {
  return useContext(MusicPlayerContext);
}
