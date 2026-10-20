"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useCaptionsEditor } from "@/components/subtitle-editor/captions/captions-context";
import { CaptionRow, type DropWordHandler } from "@/components/subtitle-editor/captions/caption-row";
import {
  DRAG_TYPE,
  keyOnLine,
  type DraggedWord,
} from "@/components/subtitle-editor/captions/shared";
import { moveWord, type WordPosition } from "@/components/subtitle-editor/chunk-edits";
import type { SubtitleChunk } from "@/remotion/types";

/**
 * The caption list from Submagic's Captions tab, built to its measured
 * spec: rows follow playback, the spoken word fills grey, words are edited
 * in place and can be dragged to another line.
 *
 * Playback moves the spoken word a few times a second. Each line is a
 * memoized CaptionRow, so only the lines whose highlight changed re-render.
 * That only holds while every prop passed to a row keeps its identity: pass
 * state, setters and useCallback functions, never inline ones.
 */
export function CaptionLines({
  activeLineIndex,
  activeWord,
  matches,
}: {
  /** The line on screen in the preview, or -1. */
  activeLineIndex: number;
  /** The word being spoken, for the karaoke fill. */
  activeWord: WordPosition | null;
  /** Words matching Find and replace, as word keys. */
  matches?: Set<string>;
}) {
  const { chunks, onChunksChange } = useCaptionsEditor();
  const listRef = useRef<HTMLOListElement>(null);
  /** The word whose menu is open, as a word key. */
  const [openWord, setOpenWord] = useState<string | null>(null);
  /** Line indexes ticked for the bulk actions. */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /** Where a dragged word would land: a word key, or "line:end". */
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useFollowPlayback(listRef, activeLineIndex, openWord !== null);

  const insertAfter = useCallback(
    (lineIndex: number) => onChunksChange(insertLineAfter(chunks, lineIndex)),
    [chunks, onChunksChange],
  );

  const toggleSelected = useCallback(
    (lineIndex: number) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(lineIndex)) next.delete(lineIndex);
        else next.add(lineIndex);
        return next;
      }),
    [],
  );

  const dropWord = useCallback<DropWordHandler>(
    (event, toLine, toWord) => {
      const raw = event.dataTransfer.getData(DRAG_TYPE);
      setDropTarget(null);
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      const from = JSON.parse(raw) as DraggedWord;
      onChunksChange(moveWord(chunks, from.lineIndex, from.wordIndex, toLine, toWord));
    },
    [chunks, onChunksChange],
  );

  if (chunks.length === 0) {
    return (
      <div className="space-y-3 rounded-xl bg-muted px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No caption lines.</p>
        <Button variant="outline" size="sm" onClick={() => insertAfter(-1)}>
          <Plus />
          Add a line
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selected.size > 0 ? (
        <SelectionBar selected={selected} onClear={() => setSelected(new Set())} />
      ) : null}

      <ol ref={listRef}>
        {chunks.map((chunk, lineIndex) => (
          <CaptionRow
            key={`${lineIndex}-${chunk.start}`}
            lineIndex={lineIndex}
            isActive={lineIndex === activeLineIndex}
            speakingWord={activeWord?.lineIndex === lineIndex ? activeWord.wordIndex : -1}
            isSelected={selected.has(lineIndex)}
            openWord={keyOnLine(openWord, lineIndex)}
            dropTarget={keyOnLine(dropTarget, lineIndex)}
            matches={matches}
            onOpenWord={setOpenWord}
            onDropTargetChange={setDropTarget}
            onToggleSelected={toggleSelected}
            onInsertAfter={insertAfter}
            onDropWord={dropWord}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * Keeps the playing line near the top of the list, unless the user is
 * editing: a word menu is open or a word has the text cursor.
 */
function useFollowPlayback(
  listRef: React.RefObject<HTMLOListElement | null>,
  activeLineIndex: number,
  isMenuOpen: boolean,
) {
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeLineIndex < 0 || isMenuOpen) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && list.contains(focused) && focused.isContentEditable) {
      return;
    }
    list
      .querySelector<HTMLElement>(`[data-chunk-index="${activeLineIndex}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [listRef, activeLineIndex, isMenuOpen]);
}

/** A new one-word line after `lineIndex` (-1 for the start), timed into the gap. */
function insertLineAfter(chunks: SubtitleChunk[], lineIndex: number): SubtitleChunk[] {
  const current = chunks[lineIndex];
  const following = chunks[lineIndex + 1];
  const start = current ? current.end : 0;
  const end = Math.max(following ? following.start : start + 2, start + 0.3);
  const next = [...chunks];
  next.splice(lineIndex + 1, 0, {
    text: "word",
    start,
    end,
    words: [{ word: "word", start, end }],
  });
  return next;
}

/** Bulk actions for the ticked lines. */
function SelectionBar({
  selected,
  onClear,
}: {
  selected: Set<number>;
  onClear: () => void;
}) {
  const { chunks, onChunksChange } = useCaptionsEditor();

  const setHidden = (hidden: boolean) =>
    onChunksChange(chunks.map((chunk, i) => (selected.has(i) ? { ...chunk, hidden } : chunk)));

  const deleteSelected = () => {
    onChunksChange(chunks.filter((_, i) => !selected.has(i)));
    onClear();
  };

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm shadow-sm">
      <span className="flex-1 tabular-nums">{selected.size} selected</span>
      <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
        Hide
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setHidden(false)}>
        Show
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={deleteSelected}>
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
