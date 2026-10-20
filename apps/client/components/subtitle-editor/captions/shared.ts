/** Small helpers shared by the caption list's components. */

/** Identifies a word as "line:word", e.g. "4:2". */
export const wordKey = (lineIndex: number, wordIndex: number) => `${lineIndex}:${wordIndex}`;

/** `key` when it's a word key on line `lineIndex` (or "line:end"), else null. */
export const keyOnLine = (key: string | null, lineIndex: number) =>
  key?.startsWith(`${lineIndex}:`) ? key : null;

/** The drag-and-drop data type for a word being moved between lines. */
export const DRAG_TYPE = "application/x-caption-word";

/** What a dragged word carries. */
export interface DraggedWord {
  lineIndex: number;
  wordIndex: number;
}

/** "0.2 - 1.28": seconds, as the time badge shows them. */
export const formatSeconds = (n: number) => String(Number(n.toFixed(2)));

/** The small icon buttons on the right of each caption line. */
export const ROW_ICON_CLASS =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4";
