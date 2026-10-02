export const BOTTOM_PROMPT_DOCK_CLASS =
  "fixed left-14 lg:left-60 right-0 z-30 flex justify-center px-3 sm:px-6 pointer-events-none bottom-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))] sm:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))]";

export const BOTTOM_PROMPT_DOCK_CLASS_COMPACT =
  "fixed left-14 sm:left-[68px] right-0 z-30 flex justify-center px-3 sm:px-6 pointer-events-none bottom-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))] sm:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))]";

export type MusicPlayerView = "minimized" | "mini" | "expanded";

export const MUSIC_PLAYER_SHELL_CLASS =
  "fixed z-40 max-sm:left-14 max-sm:right-3 sm:left-auto sm:right-4 sm:w-[min(calc(100vw-5rem),360px)] bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]";
