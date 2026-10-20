"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUp,
  CaretRight,
  Eye,
  EyeSlash,
  KeyReturn,
  List,
  MusicNotes,
  Plus,
  SmileyWink,
  TextAa,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  WORD_SOUNDS,
  type CaptionPlacement,
  type KeywordLevel,
  type LineSize,
  type SubtitleStylePreset,
  type WordSound,
} from "@/components/subtitle-editor/caption-style";
import {
  addWordAfter,
  addWordAtEnd,
  applyLineToAll,
  moveToPreviousLine,
  moveWord,
  removeWord,
  resetAllLines,
  resetLine,
  setLine,
  setWordKeyword,
  setWordText,
  setWordTiming,
  splitLine,
  toggleLineBreak,
  withWordSound,
} from "@/components/subtitle-editor/chunk-edits";
import {
  ChoiceGroup,
  ChoiceItem,
  SelectField,
  SliderField,
  SwitchRow,
} from "@/components/subtitle-editor/editor-fields";
import { EMOJI_GROUPS } from "@/components/subtitle-editor/emoji-data";
import { SoundPlayButton, playSound } from "@/components/subtitle-editor/sound-preview";
import { cn } from "@/lib/utils";
import type { SubtitleChunk } from "@/remotion/types";

const wordKey = (c: number, w: number) => `${c}:${w}`;

const HIGHLIGHTS: {
  value: KeywordLevel | undefined;
  label: string;
  key: string;
}[] = [
  { value: undefined, label: "None", key: "n" },
  { value: 1, label: "Main", key: "h" },
  { value: 2, label: "Second", key: "j" },
  { value: 3, label: "Third", key: "k" },
];

const LINE_SIZES: { value: LineSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const DEFAULT_STYLE = "default";
const DRAG_TYPE = "application/x-caption-word";

/** "0.2 - 1.28": seconds, as the time badge shows them. */
const seconds = (n: number) => String(Number(n.toFixed(2)));

interface CaptionLinesProps {
  chunks: SubtitleChunk[];
  activeChunkIndex: number;
  /** The word being spoken, for the karaoke fill. */
  activeWord: { c: number; w: number } | null;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onSeek: (seconds: number) => void;
  /** The project's template, for highlight colors. */
  preset: SubtitleStylePreset;
  placement: CaptionPlacement;
  /** Templates a line can use instead of the project's. */
  templates: SubtitleStylePreset[];
  /** Words matching Find and replace, as "line:word" keys. */
  matches?: Set<string>;
}

/**
 * The caption list from Submagic's Captions tab, built to its measured
 * spec: rows follow playback, the spoken word fills grey, words are edited
 * in place and can be dragged to another line.
 */
export function CaptionLines({
  chunks,
  activeChunkIndex,
  activeWord,
  onChunksChange,
  onSeek,
  preset,
  placement,
  templates,
  matches,
}: CaptionLinesProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Keep the playing line near the top, unless something is being edited.
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeChunkIndex < 0 || openWord) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && list.contains(focused) && focused.isContentEditable) {
      return;
    }
    list
      .querySelector<HTMLElement>(`[data-chunk-index="${activeChunkIndex}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeChunkIndex, openWord]);

  const insertAfter = (index: number) => {
    const current = chunks[index];
    const following = chunks[index + 1];
    const start = current ? current.end : 0;
    const end = Math.max(following ? following.start : start + 2, start + 0.3);
    const next = [...chunks];
    next.splice(index + 1, 0, {
      text: "word",
      start,
      end,
      words: [{ word: "word", start, end }],
    });
    onChunksChange(next);
  };

  const toggleSelected = (c: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const dropWord = (event: React.DragEvent, toC: number, toW: number) => {
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    setDropTarget(null);
    if (!raw) return;
    event.preventDefault();
    event.stopPropagation();
    const { c, w } = JSON.parse(raw) as { c: number; w: number };
    onChunksChange(moveWord(chunks, c, w, toC, toW));
  };

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
        <div className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm shadow-sm">
          <span className="flex-1 tabular-nums">{selected.size} selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChunksChange(chunks.map((c, i) => (selected.has(i) ? { ...c, hidden: true } : c)))
            }
          >
            Hide
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChunksChange(chunks.map((c, i) => (selected.has(i) ? { ...c, hidden: false } : c)))
            }
          >
            Show
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              onChunksChange(chunks.filter((_, i) => !selected.has(i)));
              setSelected(new Set());
            }}
          >
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <ol ref={listRef}>
        {chunks.map((chunk, c) => {
          const lineNumber = c + 1;
          const isActive = c === activeChunkIndex;
          const isSelected = selected.has(c);
          return (
            <li key={`${c}-${chunk.start}`} className="group relative">
              <div
                data-chunk-index={c}
                data-active={isActive}
                onClick={(event) => {
                  if (event.target === event.currentTarget) onSeek(chunk.start);
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(DRAG_TYPE)) {
                    event.preventDefault();
                    setDropTarget(`${c}:end`);
                  }
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(event) => dropWord(event, c, chunk.words.length)}
                className={cn(
                  "flex scroll-mt-1 items-start justify-between gap-3 rounded-lg p-3 transition-colors duration-200 ease-in-out hover:bg-[#F9FAFB] dark:hover:bg-muted/40",
                  isActive && "bg-[#F2F3F5] hover:bg-[#F2F3F5] dark:bg-muted dark:hover:bg-muted",
                  dropTarget === `${c}:end` && "ring-1 ring-[#3F83F8]",
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Select line ${lineNumber}`}
                  checked={isSelected}
                  onChange={() => toggleSelected(c)}
                  className={cn(
                    "mt-0.5 size-4 shrink-0 cursor-pointer rounded-[4px] accent-[#3F83F8] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
                    (isActive || isSelected) && "opacity-100",
                  )}
                />

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-0.5",
                    chunk.hidden && "opacity-50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSeek(chunk.start)}
                    aria-label={`Play line ${lineNumber} from ${seconds(chunk.start)} seconds`}
                    className="self-start rounded-md px-[5px] py-px text-xs leading-[18px] font-medium tabular-nums text-[#8C8C92] outline-none transition-colors duration-200 hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/10"
                  >
                    {seconds(chunk.start)} - {seconds(chunk.end)}
                  </button>
                  <div className="flex flex-wrap items-center text-base leading-5 text-[#212224] dark:text-foreground">
                    {chunk.words.map((word, w) => {
                      const key = wordKey(c, w);
                      const highlight =
                        word.keyword && preset.keywordColors
                          ? preset.keywordColors[word.keyword - 1]
                          : undefined;
                      const speaking = activeWord?.c === c && activeWord.w === w;
                      return (
                        <span key={key} className="contents">
                          <span
                            className={cn(
                              "group/word relative mx-0.5 inline-flex min-h-7 items-center",
                              dropTarget === key && "before:absolute before:-left-1 before:top-1 before:bottom-1 before:w-0.5 before:rounded before:bg-[#3F83F8]",
                            )}
                            onDragOver={(event) => {
                              if (event.dataTransfer.types.includes(DRAG_TYPE)) {
                                event.preventDefault();
                                event.stopPropagation();
                                setDropTarget(key);
                              }
                            }}
                            onDrop={(event) => dropWord(event, c, w)}
                          >
                            {/* The karaoke fill: grows behind the word being spoken. */}
                            <span
                              aria-hidden
                              className={cn(
                                "pointer-events-none absolute inset-0 z-0 scale-50 rounded-[4px] bg-transparent transition-[transform,background-color] duration-[470ms,200ms] ease-[cubic-bezier(.23,1,.32,1),ease]",
                                speaking && "scale-100 bg-[#DEE0E3] dark:bg-white/15",
                              )}
                            />
                            <span
                              draggable
                              aria-label={`Drag "${word.word}" to another line`}
                              onDragStart={(event) => {
                                event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ c, w }));
                                event.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => setDropTarget(null)}
                              className="absolute -top-4 left-1/2 z-20 flex h-4 w-[29px] -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-[#3F83F8] text-white opacity-0 transition-opacity duration-200 group-hover/word:opacity-100 active:cursor-grabbing"
                            >
                              <List className="size-3" weight="bold" />
                            </span>
                            <EditableWord
                              chunks={chunks}
                              c={c}
                              w={w}
                              preset={preset}
                              open={openWord === key}
                              onOpenChange={(open) => {
                                setOpenWord(open ? key : null);
                                if (open) onSeek(word.start);
                              }}
                              onChunksChange={onChunksChange}
                              onOpenWord={setOpenWord}
                              highlight={highlight}
                              match={Boolean(matches?.has(key))}
                            />
                          </span>
                          {word.lineBreak && w < chunk.words.length - 1 ? (
                            <button
                              type="button"
                              aria-label="Remove line break"
                              title="Remove line break"
                              onClick={() => onChunksChange(toggleLineBreak(chunks, c, w))}
                              className="mr-1 inline-flex cursor-pointer items-center text-[#9CA3AF] outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <KeyReturn className="size-4" />
                            </button>
                          ) : null}
                        </span>
                      );
                    })}
                    {chunk.emoji ? <span className="mx-1 text-base">{chunk.emoji}</span> : null}
                    <button
                      type="button"
                      aria-label={`Add a word to line ${lineNumber}`}
                      onClick={() => {
                        onChunksChange(addWordAtEnd(chunks, c));
                        setOpenWord(wordKey(c, chunk.words.length));
                      }}
                      className="ml-0.5 inline-flex size-6 items-center justify-center rounded-md text-[#A9A9AE] opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex shrink-0 items-center rounded-md bg-white p-0.5 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 focus-within:opacity-100 dark:bg-background",
                    isActive && "opacity-100",
                  )}
                >
                  <EmojiButton
                    emoji={chunk.emoji ?? chunk.words.find((w) => w.emoji)?.emoji}
                    lineNumber={lineNumber}
                    onChange={(emoji) => {
                      // A removed AI pick is cleared from its word too.
                      const next = setLine(chunks, c, { emoji });
                      onChunksChange(
                        emoji
                          ? next
                          : next.map((line, i) =>
                              i === c
                                ? { ...line, words: line.words.map((w) => ({ ...w, emoji: undefined })) }
                                : line,
                            ),
                      );
                    }}
                  />
                  <LineMenu
                    chunks={chunks}
                    c={c}
                    placement={placement}
                    templates={templates}
                    onChunksChange={onChunksChange}
                  />
                  <button
                    type="button"
                    aria-pressed={Boolean(chunk.hidden)}
                    aria-label={
                      chunk.hidden
                        ? `Show line ${lineNumber} on the video`
                        : `Hide line ${lineNumber} on the video`
                    }
                    onClick={() =>
                      onChunksChange(setLine(chunks, c, { hidden: !chunk.hidden }))
                    }
                    className={ROW_ICON_CLASS}
                  >
                    {chunk.hidden ? <Eye /> : <EyeSlash />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                aria-label={`Add a line after line ${lineNumber}`}
                onClick={() => insertAfter(c)}
                className="absolute bottom-0 left-1/2 z-10 flex size-5 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border bg-white text-[#A9A9AE] opacity-0 shadow-sm outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100 dark:bg-background"
              >
                <Plus className="size-3" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const ROW_ICON_CLASS =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4";

/** A word edited in place; clicking it also opens the word menu. */
function EditableWord({
  chunks,
  c,
  w,
  preset,
  open,
  onOpenChange,
  onChunksChange,
  onOpenWord,
  highlight,
  match,
}: {
  chunks: SubtitleChunk[];
  c: number;
  w: number;
  preset: SubtitleStylePreset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onOpenWord: (key: string | null) => void;
  highlight?: string;
  match: boolean;
}) {
  const word = chunks[c].words[w];
  const shortcuts = useWordShortcuts(chunks, c, w, onChunksChange, onOpenWord);

  const commit = (element: HTMLElement) => {
    const text = (element.textContent ?? "").trim();
    if (text === word.word) return;
    if (!text) {
      onChunksChange(removeWord(chunks, c, w));
      onOpenWord(null);
      return;
    }
    onChunksChange(setWordText(chunks, c, w, text));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            role="textbox"
            aria-label={`Word "${word.word}"`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(event) => commit(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
                return;
              }
              if (event.key === "Escape") {
                event.currentTarget.textContent = word.word;
                event.currentTarget.blur();
                return;
              }
              shortcuts(event);
            }}
            className={cn(
              "relative z-10 rounded-[4px] border border-transparent px-0.5 outline-none transition-colors duration-200 hover:border-[#3F83F8] focus:border-[#3F83F8] data-[popup-open]:border-[#3F83F8]",
              match && "bg-yellow-200 dark:bg-yellow-500/40",
            )}
          />
        }
      >
        {word.word}
        {word.punctuation ? (
          <span contentEditable={false} className="text-muted-foreground">
            {word.punctuation}
          </span>
        ) : null}
        {highlight ? (
          <span
            aria-hidden
            contentEditable={false}
            className="pointer-events-none absolute bottom-[0.1em] left-0 h-0.5 w-full shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
            style={{ background: highlight }}
          />
        ) : null}
        {word.emoji ? (
          <span contentEditable={false} className="ml-0.5 text-sm">
            {word.emoji}
          </span>
        ) : null}
        {word.sound ? (
          <span contentEditable={false} aria-label="Has a sound" className="ml-0.5 inline-flex">
            <MusicNotes className="size-3 text-[#3F83F8]" />
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        initialFocus={false}
        className="w-72 gap-0 p-0"
      >
        <WordMenu
          chunks={chunks}
          c={c}
          w={w}
          preset={preset}
          onChunksChange={onChunksChange}
          onOpenWord={onOpenWord}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The word menu's keyboard shortcuts, for the word and the menu alike. */
function useWordShortcuts(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  onChunksChange: (chunks: SubtitleChunk[]) => void,
  onOpenWord: (key: string | null) => void,
) {
  return (event: React.KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    const isLast = w === chunks[c].words.length - 1;
    const highlight = HIGHLIGHTS.find((h) => h.key === key);
    const close = (next: SubtitleChunk[]) => {
      onOpenWord(null);
      onChunksChange(next);
    };
    let run: (() => void) | null = null;
    if (highlight) run = () => onChunksChange(setWordKeyword(chunks, c, w, highlight.value));
    else if (key === "b" && !isLast) run = () => close(splitLine(chunks, c, w + 1));
    else if (key === "arrowup" && c > 0) run = () => close(moveToPreviousLine(chunks, c, w));
    else if (key === "i") {
      run = () => {
        onChunksChange(addWordAfter(chunks, c, w));
        onOpenWord(wordKey(c, w + 1));
      };
    } else if (key === "d") run = () => close(removeWord(chunks, c, w));
    if (!run) return;
    event.preventDefault();
    run();
  };
}

function WordMenu({
  chunks,
  c,
  w,
  preset,
  onChunksChange,
  onOpenWord,
}: {
  chunks: SubtitleChunk[];
  c: number;
  w: number;
  preset: SubtitleStylePreset;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onOpenWord: (key: string | null) => void;
}) {
  const [soundsOpen, setSoundsOpen] = useState(false);
  const shortcuts = useWordShortcuts(chunks, c, w, onChunksChange, onOpenWord);
  const chunk = chunks[c];
  const word = chunk?.words[w];
  // Only rendered while open, so reading the platform here is safe.
  const mod =
    typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform)
      ? "⌘"
      : "Ctrl+";

  if (!chunk || !word) return null;

  const isLast = w === chunk.words.length - 1;

  /** Applies an edit that moves the word elsewhere, then closes the menu. */
  const apply = (next: SubtitleChunk[]) => {
    onOpenWord(null);
    onChunksChange(next);
  };

  const actions: {
    label: string;
    icon: React.ReactNode;
    keys: string;
    shortcut: string;
    show: boolean;
    destructive?: boolean;
    run: () => void;
  }[] = [
    {
      label: "Add line break",
      icon: <KeyReturn />,
      keys: `${mod}B`,
      shortcut: "b",
      show: !isLast,
      run: () => apply(splitLine(chunks, c, w + 1)),
    },
    {
      label: "Move to prev line",
      icon: <ArrowUp />,
      keys: `${mod}↑`,
      shortcut: "ArrowUp",
      show: c > 0,
      run: () => apply(moveToPreviousLine(chunks, c, w)),
    },
    {
      label: "Add word",
      icon: <Plus />,
      keys: `${mod}I`,
      shortcut: "i",
      show: true,
      run: () => {
        onChunksChange(addWordAfter(chunks, c, w));
        onOpenWord(wordKey(c, w + 1));
      },
    },
    {
      label: "Remove word",
      icon: <Trash />,
      keys: `${mod}D`,
      shortcut: "d",
      show: true,
      destructive: true,
      run: () => apply(removeWord(chunks, c, w)),
    },
  ];
  const visible = actions.filter((action) => action.show);

  const setHighlight = (level: KeywordLevel | undefined) =>
    onChunksChange(setWordKeyword(chunks, c, w, level));

  return (
    <div onKeyDown={shortcuts}>
      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Highlight color
          </span>
          <div role="group" aria-label="Highlight color" className="grid grid-cols-4 gap-1">
            {HIGHLIGHTS.map((option) => {
              const color = option.value
                ? preset.keywordColors?.[option.value - 1]
                : undefined;
              return (
                <button
                  key={option.label}
                  type="button"
                  title={`${mod}${option.key.toUpperCase()}`}
                  aria-pressed={word.keyword === option.value}
                  onClick={() => setHighlight(option.value)}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                >
                  {color ? (
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full ring-1 ring-foreground/20"
                      style={{ backgroundColor: color }}
                    />
                  ) : null}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TimeField
            label="Start"
            value={word.start}
            onCommit={(start) =>
              onChunksChange(setWordTiming(chunks, c, w, { start }))
            }
          />
          <TimeField
            label="End"
            value={word.end}
            onCommit={(end) =>
              onChunksChange(setWordTiming(chunks, c, w, { end }))
            }
          />
        </div>
      </div>
      <div className="border-t p-1">
        {visible.slice(0, 2).map((action) => (
          <MenuAction key={action.label} {...action} />
        ))}
        <Popover open={soundsOpen} onOpenChange={setSoundsOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
              />
            }
          >
            <MusicNotes />
            <span className="flex-1">
              {word.sound
                ? WORD_SOUNDS.find((s) => s.value === word.sound)?.label
                : "Add sound"}
            </span>
            <CaretRight />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" sideOffset={8} className="w-56 gap-0 p-1">
            <div className="max-h-72 overflow-y-auto">
              {[{ value: undefined, label: "No sound" }, ...WORD_SOUNDS].map(
                (sound) => (
                  <div key={sound.label} className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-pressed={word.sound === sound.value}
                      onClick={() => {
                        const picked = sound.value as WordSound | undefined;
                        onChunksChange(withWordSound(chunks, c, w, picked));
                        setSoundsOpen(false);
                        if (picked) playSound(picked);
                      }}
                      className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted aria-pressed:font-medium aria-pressed:text-primary"
                    >
                      {sound.label}
                    </button>
                    {sound.value ? (
                      <SoundPlayButton id={sound.value} label={sound.label} />
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </PopoverContent>
        </Popover>
        {visible.slice(2).map((action) => (
          <MenuAction key={action.label} {...action} />
        ))}
      </div>
    </div>
  );
}

function MenuAction({
  label,
  icon,
  keys,
  destructive,
  run,
}: {
  label: string;
  icon: React.ReactNode;
  keys: string;
  destructive?: boolean;
  run: () => void;
}) {
  return (
    <button
      type="button"
      onClick={run}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0",
        destructive ? "text-destructive" : "[&_svg]:text-muted-foreground",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <Kbd>{keys}</Kbd>
    </button>
  );
}

/** The Caption Line menu: the line's size, position, template and emphasis. */
function LineMenu({
  chunks,
  c,
  placement,
  templates,
  onChunksChange,
}: {
  chunks: SubtitleChunk[];
  c: number;
  placement: CaptionPlacement;
  templates: SubtitleStylePreset[];
  onChunksChange: (chunks: SubtitleChunk[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const chunk = chunks[c];
  const styleOptions = [
    { value: DEFAULT_STYLE, label: "Default" },
    ...templates.map((t) => ({ value: t.id, label: t.name })),
  ];

  const finish = (next: SubtitleChunk[]) => {
    onChunksChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Size and position of line ${c + 1}`}
            className={cn(
              ROW_ICON_CLASS,
              (chunk.size || chunk.positionY !== undefined || chunk.style || chunk.emphasize) &&
                "text-[#3F83F8]",
            )}
          />
        }
      >
        <TextAa />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 gap-4">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Size</span>
          <ChoiceGroup
            label="Line size"
            value={chunk.size ?? "medium"}
            onChange={(size) =>
              onChunksChange(setLine(chunks, c, { size: size === "medium" ? undefined : size }))
            }
            className="grid grid-cols-3"
          >
            {LINE_SIZES.map((size) => (
              <ChoiceItem key={size.value} value={size.value}>
                {size.label}
              </ChoiceItem>
            ))}
          </ChoiceGroup>
        </div>
        <SliderField
          label="Position Y"
          unit="%"
          value={Math.round(chunk.positionY ?? placement.y)}
          min={0}
          max={100}
          defaultValue={Math.round(placement.y)}
          onChange={(positionY) => onChunksChange(setLine(chunks, c, { positionY }))}
        />
        <SelectField
          label="Style"
          options={styleOptions}
          value={chunk.style?.id ?? DEFAULT_STYLE}
          onChange={(id) =>
            onChunksChange(
              setLine(chunks, c, {
                style: templates.find((t) => t.id === id),
              }),
            )
          }
        />
        <SwitchRow
          label="Emphasize text"
          checked={Boolean(chunk.emphasize)}
          onCheckedChange={(emphasize) =>
            onChunksChange(setLine(chunks, c, { emphasize: emphasize || undefined }))
          }
        />
        <div className="-mx-1 grid gap-0.5 border-t pt-2">
          <LineAction onClick={() => finish(applyLineToAll(chunks, c))}>
            Apply to All Lines
          </LineAction>
          <LineAction onClick={() => finish(resetAllLines(chunks))}>
            Reset All Lines
          </LineAction>
          <LineAction onClick={() => finish(resetLine(chunks, c))}>Reset</LineAction>
          <LineAction
            destructive
            onClick={() => finish(chunks.filter((_, i) => i !== c))}
          >
            Delete Line
          </LineAction>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LineAction({
  destructive,
  onClick,
  children,
}: {
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted",
        destructive && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}

/** Seconds with two decimals, applied on blur or Enter so typing isn't interrupted. */
function TimeField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (seconds: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value.toFixed(2));
  const [shown, setShown] = useState(value);
  // Pick up changes made elsewhere (another field, an undo).
  if (shown !== value) {
    setShown(value);
    setDraft(value.toFixed(2));
  }

  const commit = () => {
    const seconds = Number(draft);
    if (Number.isFinite(seconds) && seconds >= 0) onCommit(seconds);
    else setDraft(value.toFixed(2));
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className="tabular-nums"
      />
    </div>
  );
}

/** Add emoji, or Remove emoji when the line has one. */
function EmojiButton({
  emoji,
  lineNumber,
  onChange,
}: {
  emoji?: string;
  lineNumber: number;
  onChange: (emoji: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = EMOJI_GROUPS.map((group) => ({
    ...group,
    emojis: needle
      ? group.emojis.filter(([, keywords]) => keywords.includes(needle))
      : group.emojis,
  })).filter((group) => group.emojis.length > 0);

  const pick = (next: string | undefined) => {
    onChange(next);
    setOpen(false);
  };

  if (emoji) {
    return (
      <button
        type="button"
        aria-label={`Remove emoji ${emoji} from line ${lineNumber}`}
        title="Remove emoji"
        onClick={() => onChange(undefined)}
        className={cn(ROW_ICON_CLASS, "text-base")}
      >
        {emoji}
      </button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("");
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Add an emoji to line ${lineNumber}`}
            title="Add emoji"
            className={ROW_ICON_CLASS}
          />
        }
      >
        <SmileyWink />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 gap-3">
        <Input
          type="search"
          autoFocus
          aria-label="Search emoji"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search emoji"
        />
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No emoji match &ldquo;{query}&rdquo;.
            </p>
          ) : null}
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map(([char, keywords]) => (
                  <button
                    key={char}
                    type="button"
                    title={keywords}
                    aria-label={keywords.split(" ")[0]}
                    onClick={() => pick(char)}
                    className="flex aspect-square items-center justify-center rounded-md text-xl outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
