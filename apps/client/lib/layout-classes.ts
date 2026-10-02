/**
 * Composer dock for tool pages. It sits in normal flow at the end of the
 * page and sticks to the bottom of the viewport, so it always lines up with
 * the content column whatever the sidebar is doing. The fade behind it keeps
 * results from showing through under the composer.
 */
export const BOTTOM_PROMPT_DOCK_CLASS =
  "pointer-events-none sticky bottom-0 z-20 flex justify-center bg-linear-to-t from-card from-60% to-transparent px-3 pt-6 pb-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))] sm:px-6 sm:pb-[calc(max(1.25rem,env(safe-area-inset-bottom,0px))+var(--music-player-height,0px))]";

/** Same dock; kept as a separate name for forms that imported it. */
export const BOTTOM_PROMPT_DOCK_CLASS_COMPACT = BOTTOM_PROMPT_DOCK_CLASS;

export type MusicPlayerView = "minimized" | "mini" | "expanded";

export const MUSIC_PLAYER_SHELL_CLASS =
  "fixed z-40 max-sm:inset-x-3 sm:right-4 sm:w-[min(calc(100vw-2rem),360px)] bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]";
