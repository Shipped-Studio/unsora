"use client";

import { memo } from "react";
import { Eye, EyeSlash, KeyReturn, List, Plus } from "@phosphor-icons/react";
import { useCaptionsEditor } from "@/components/subtitle-editor/captions/captions-context";
import { EmojiButton } from "@/components/subtitle-editor/captions/emoji-button";
import { LineMenu } from "@/components/subtitle-editor/captions/line-menu";
import {
  DRAG_TYPE,
  ROW_ICON_CLASS,
  formatSeconds,
  wordKey,
  type DraggedWord,
} from "@/components/subtitle-editor/captions/shared";
import { EditableWord } from "@/components/subtitle-editor/captions/word-menu";
import { addWordAtEnd, setLine, toggleLineBreak } from "@/components/subtitle-editor/chunk-edits";
import { cn } from "@/lib/utils";

/** Drop handler: moves the dragged word to `toLine`, before word `toWord`. */
export type DropWordHandler = (event: React.DragEvent, toLine: number, toWord: number) => void;

interface CaptionRowProps {
  lineIndex: number;
  /** The line is on screen in the preview. */
  isActive: boolean;
  /** Index of the word being spoken on this line, or -1. */
  speakingWord: number;
  isSelected: boolean;
  /** The open word menu's key when it's on this line, else null. */
  openWord: string | null;
  /** The drop target's key when it's on this line, else null. */
  dropTarget: string | null;
  /** Words matching Find and replace, as word keys. */
  matches?: Set<string>;
  onOpenWord: (key: string | null) => void;
  onDropTargetChange: (key: string | null) => void;
  onToggleSelected: (lineIndex: number) => void;
  onInsertAfter: (lineIndex: number) => void;
  onDropWord: DropWordHandler;
}

/**
 * One caption line: its time, its words and the line's tools.
 *
 * Memoized: during playback only the rows whose `isActive` or
 * `speakingWord` changed re-render.
 */
export const CaptionRow = memo(function CaptionRow({
  lineIndex,
  isActive,
  speakingWord,
  isSelected,
  openWord,
  dropTarget,
  matches,
  onOpenWord,
  onDropTargetChange,
  onToggleSelected,
  onInsertAfter,
  onDropWord,
}: CaptionRowProps) {
  const { chunks, onChunksChange, onSeek } = useCaptionsEditor();
  const line = chunks[lineIndex];
  const lineNumber = lineIndex + 1;
  const endKey = `${lineIndex}:end`;

  const changeEmoji = (emoji: string | undefined) => {
    const next = setLine(chunks, lineIndex, { emoji });
    if (emoji) {
      onChunksChange(next);
      return;
    }
    // A removed AI pick is cleared from its word too.
    onChunksChange(
      next.map((chunk, i) =>
        i === lineIndex
          ? { ...chunk, words: chunk.words.map((word) => ({ ...word, emoji: undefined })) }
          : chunk,
      ),
    );
  };

  return (
    <li className="group relative">
      <div
        data-chunk-index={lineIndex}
        data-active={isActive}
        onClick={(event) => {
          // Clicks on the row's background, not on its buttons or words.
          if (event.target === event.currentTarget) onSeek(line.start);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(DRAG_TYPE)) {
            event.preventDefault();
            onDropTargetChange(endKey);
          }
        }}
        onDragLeave={() => onDropTargetChange(null)}
        onDrop={(event) => onDropWord(event, lineIndex, line.words.length)}
        className={cn(
          "flex scroll-mt-1 items-start justify-between gap-3 rounded-lg p-3 transition-colors duration-200 ease-in-out hover:bg-muted/40",
          isActive && "bg-muted hover:bg-muted",
          dropTarget === endKey && "ring-1 ring-info",
        )}
      >
        <input
          type="checkbox"
          aria-label={`Select line ${lineNumber}`}
          checked={isSelected}
          onChange={() => onToggleSelected(lineIndex)}
          className={cn(
            "mt-0.5 size-4 shrink-0 cursor-pointer rounded-[4px] accent-info opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            (isActive || isSelected) && "opacity-100",
          )}
        />

        <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", line.hidden && "opacity-50")}>
          <button
            type="button"
            onClick={() => onSeek(line.start)}
            aria-label={`Play line ${lineNumber} from ${formatSeconds(line.start)} seconds`}
            className="self-start rounded-md px-[5px] py-px text-xs leading-[18px] font-medium tabular-nums text-muted-foreground outline-none transition-colors duration-200 hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/10"
          >
            {formatSeconds(line.start)} - {formatSeconds(line.end)}
          </button>
          <div className="flex flex-wrap items-center text-base leading-5 text-foreground">
            {line.words.map((_, wordIndex) => {
              const key = wordKey(lineIndex, wordIndex);
              return (
                <CaptionWord
                  key={key}
                  lineIndex={lineIndex}
                  wordIndex={wordIndex}
                  speaking={wordIndex === speakingWord}
                  isDropTarget={dropTarget === key}
                  open={openWord === key}
                  match={Boolean(matches?.has(key))}
                  onOpenWord={onOpenWord}
                  onDropTargetChange={onDropTargetChange}
                  onDropWord={onDropWord}
                />
              );
            })}
            {line.emoji ? <span className="mx-1 text-base">{line.emoji}</span> : null}
            <button
              type="button"
              aria-label={`Add a word to line ${lineNumber}`}
              onClick={() => {
                onChunksChange(addWordAtEnd(chunks, lineIndex));
                onOpenWord(wordKey(lineIndex, line.words.length));
              }}
              className="ml-0.5 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center rounded-md bg-card p-0.5 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 focus-within:opacity-100",
            isActive && "opacity-100",
          )}
        >
          <EmojiButton
            emoji={line.emoji ?? line.words.find((word) => word.emoji)?.emoji}
            lineNumber={lineNumber}
            onChange={changeEmoji}
          />
          <LineMenu lineIndex={lineIndex} />
          <button
            type="button"
            aria-pressed={Boolean(line.hidden)}
            aria-label={
              line.hidden
                ? `Show line ${lineNumber} on the video`
                : `Hide line ${lineNumber} on the video`
            }
            onClick={() => onChunksChange(setLine(chunks, lineIndex, { hidden: !line.hidden }))}
            className={ROW_ICON_CLASS}
          >
            {line.hidden ? <Eye /> : <EyeSlash />}
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label={`Add a line after line ${lineNumber}`}
        onClick={() => onInsertAfter(lineIndex)}
        className="absolute bottom-0 left-1/2 z-10 flex size-5 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100 dark:bg-background"
      >
        <Plus className="size-3" />
      </button>
    </li>
  );
});

/** A word in a line: the karaoke fill, a drag handle and the editable text. */
function CaptionWord({
  lineIndex,
  wordIndex,
  speaking,
  isDropTarget,
  open,
  match,
  onOpenWord,
  onDropTargetChange,
  onDropWord,
}: {
  lineIndex: number;
  wordIndex: number;
  speaking: boolean;
  isDropTarget: boolean;
  open: boolean;
  match: boolean;
  onOpenWord: (key: string | null) => void;
  onDropTargetChange: (key: string | null) => void;
  onDropWord: DropWordHandler;
}) {
  const { chunks, onChunksChange, onSeek, preset } = useCaptionsEditor();
  const line = chunks[lineIndex];
  const word = line.words[wordIndex];
  const key = wordKey(lineIndex, wordIndex);
  const highlight =
    word.keyword && preset.keywordColors ? preset.keywordColors[word.keyword - 1] : undefined;
  const hasBreakAfter = word.lineBreak && wordIndex < line.words.length - 1;

  return (
    <span className="contents">
      <span
        className={cn(
          "group/word relative mx-0.5 inline-flex min-h-7 items-center",
          isDropTarget && "before:absolute before:-left-1 before:top-1 before:bottom-1 before:w-0.5 before:rounded before:bg-info",
        )}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(DRAG_TYPE)) {
            event.preventDefault();
            event.stopPropagation();
            onDropTargetChange(key);
          }
        }}
        onDrop={(event) => onDropWord(event, lineIndex, wordIndex)}
      >
        {/* The karaoke fill: grows behind the word being spoken. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-0 scale-50 rounded-[4px] bg-transparent transition-[transform,background-color] duration-[470ms,200ms] ease-[cubic-bezier(.23,1,.32,1),ease]",
            speaking && "scale-100 bg-accent",
          )}
        />
        <span
          draggable
          aria-label={`Drag "${word.word}" to another line`}
          onDragStart={(event) => {
            const dragged: DraggedWord = { lineIndex, wordIndex };
            event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragged));
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => onDropTargetChange(null)}
          className="absolute -top-4 left-1/2 z-20 flex h-4 w-[29px] -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-info text-info-foreground opacity-0 transition-opacity duration-200 group-hover/word:opacity-100 active:cursor-grabbing"
        >
          <List className="size-3" weight="bold" />
        </span>
        <EditableWord
          lineIndex={lineIndex}
          wordIndex={wordIndex}
          open={open}
          onOpenChange={(next) => {
            onOpenWord(next ? key : null);
            if (next) onSeek(word.start);
          }}
          onOpenWord={onOpenWord}
          highlight={highlight}
          match={match}
        />
      </span>
      {hasBreakAfter ? (
        <button
          type="button"
          aria-label="Remove line break"
          title="Remove line break"
          onClick={() => onChunksChange(toggleLineBreak(chunks, lineIndex, wordIndex))}
          className="mr-1 inline-flex cursor-pointer items-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <KeyReturn className="size-4" />
        </button>
      ) : null}
    </span>
  );
}
