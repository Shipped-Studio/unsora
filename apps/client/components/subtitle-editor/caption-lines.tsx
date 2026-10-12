"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowsMerge,
  DotsThreeVertical,
  Eye,
  EyeSlash,
  KeyReturn,
  MagnifyingGlass,
  Plus,
  Scissors,
  SmileyWink,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addWordAfter,
  moveToNextLine,
  moveToPreviousLine,
  removeWord,
  setLine,
  setWordEffect,
  setWordText,
  setWordTiming,
  splitLine,
  toggleLineBreak,
} from "@/components/subtitle-editor/chunk-edits";
import { EMOJI_GROUPS } from "@/components/subtitle-editor/emoji-data";
import { formatTimestamp } from "@/components/subtitle-editor/format";
import { cn } from "@/lib/utils";
import type { SubtitleChunk, WordEffect } from "@/remotion/types";

const wordKey = (c: number, w: number) => `${c}:${w}`;

const WORD_EFFECTS: { value: WordEffect | undefined; label: string }[] = [
  { value: undefined, label: "None" },
  { value: "pop", label: "Pop" },
  { value: "bounce", label: "Bounce" },
  { value: "shake", label: "Shake" },
  { value: "zoom", label: "Zoom" },
  { value: "swing", label: "Swing" },
  { value: "glow", label: "Glow" },
];

/** Lowercase letters and digits only, so "Africa." matches "africa". */
const normalize = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

interface CaptionLinesProps {
  chunks: SubtitleChunk[];
  activeChunkIndex: number;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onSeek: (seconds: number) => void;
  /** Plays from `seconds`; used to show a word animation just picked. */
  onPlayFrom?: (seconds: number) => void;
}

/**
 * The transcript as clickable words. Click a word to retime, move or remove
 * it; each line has its own emoji, visibility and line actions.
 */
export function CaptionLines({
  chunks,
  activeChunkIndex,
  onChunksChange,
  onSeek,
  onPlayFrom,
}: CaptionLinesProps) {
  // Start a little early so the animation is seen from its first frame.
  const onPreviewWord = (seconds: number) =>
    (onPlayFrom ?? onSeek)(Math.max(0, seconds - 0.3));
  const listRef = useRef<HTMLOListElement>(null);
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const needle = normalize(query);

  // Follow playback while the list is on screen and nothing is being edited.
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeChunkIndex < 0 || openWord) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement && list.contains(focused)) return;
    const rect = list.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    list
      .querySelector<HTMLElement>(`[data-chunk-index="${activeChunkIndex}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeChunkIndex, openWord]);

  const matchCount = needle
    ? chunks.reduce(
        (count, chunk) =>
          count +
          chunk.words.filter((word) => normalize(word.word).includes(needle))
            .length,
        0,
      )
    : 0;

  const insertAfter = (index: number) => {
    const current = chunks[index];
    const following = chunks[index + 1];
    const next = [...chunks];
    next.splice(index + 1, 0, {
      text: "",
      start: current.end,
      end: following ? following.start : current.end + 2,
      words: [],
    });
    onChunksChange(next);
  };

  const mergeWithNext = (index: number) => {
    const current = chunks[index];
    const following = chunks[index + 1];
    if (!following) return;
    const next = [...chunks];
    next.splice(index, 2, {
      ...current,
      text: [current.text, following.text].filter(Boolean).join(" "),
      start: current.start,
      end: following.end,
      words: [...current.words, ...following.words],
      emoji: current.emoji ?? following.emoji,
    });
    onChunksChange(next);
  };

  if (chunks.length === 0) {
    return (
      <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
        No subtitle lines. Add one or transcribe again.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search subtitles"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words"
            className="pl-8"
          />
        </div>
        {needle ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </span>
        ) : null}
      </div>

      <ol ref={listRef} className="space-y-1">
        {chunks.map((chunk, c) => {
          const lineNumber = c + 1;
          return (
            <li
              key={`${c}-${chunk.start}`}
              data-chunk-index={c}
              data-active={c === activeChunkIndex}
              className="flex scroll-my-3 items-start gap-2 rounded-lg p-2 transition-colors data-[active=true]:bg-muted"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => onSeek(chunk.start)}
                  aria-label={`Play line ${lineNumber} from ${formatTimestamp(chunk.start)}`}
                  className="rounded-sm text-xs tabular-nums text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {formatTimestamp(chunk.start)} – {formatTimestamp(chunk.end)}
                </button>
                {chunk.words.length > 0 ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-0.5 gap-y-1 text-base",
                      chunk.hidden && "text-muted-foreground line-through",
                    )}
                  >
                    {chunk.words.map((word, w) => {
                      const key = wordKey(c, w);
                      const isMatch =
                        needle !== "" && normalize(word.word).includes(needle);
                      return (
                        <span key={key} className="contents">
                          <Popover
                            open={openWord === key}
                            onOpenChange={(open) => {
                              if (open) {
                                setOpenWord(key);
                                onSeek(word.start);
                                return;
                              }
                              setOpenWord(null);
                              // A word left empty is removed.
                              if (!chunks[c]?.words[w]?.word.trim()) {
                                onChunksChange(removeWord(chunks, c, w));
                              }
                            }}
                          >
                            <PopoverTrigger
                              render={
                                <button
                                  type="button"
                                  aria-label={`Edit "${word.word}"`}
                                  className={cn(
                                    "rounded-md px-1 py-0.5 outline-none ring-1 ring-transparent transition-shadow hover:ring-border focus-visible:ring-ring data-[popup-open]:ring-primary",
                                    isMatch &&
                                      "bg-yellow-200 text-foreground dark:bg-yellow-500/40",
                                  )}
                                />
                              }
                            >
                              {word.word || " "}
                              {word.effect ? (
                                <Sparkle
                                  weight="fill"
                                  aria-label={`${word.effect} animation`}
                                  className="ml-0.5 inline size-3 -translate-y-1 text-primary"
                                />
                              ) : null}
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              sideOffset={6}
                              className="w-72 gap-0 p-0"
                            >
                              <WordMenu
                                chunks={chunks}
                                c={c}
                                w={w}
                                onChunksChange={onChunksChange}
                                onOpenWord={setOpenWord}
                                onPreview={onPreviewWord}
                              />
                            </PopoverContent>
                          </Popover>
                          {word.lineBreak && w < chunk.words.length - 1 ? (
                            <KeyReturn
                              role="img"
                              aria-label="Line break"
                              className="mx-0.5 size-4 text-muted-foreground"
                            />
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    aria-label={`Line ${lineNumber}`}
                    value={chunk.text}
                    onChange={(event) => {
                      const next = [...chunks];
                      next[c] = { ...chunk, text: event.target.value };
                      onChunksChange(next);
                    }}
                    onFocus={() => onSeek(chunk.start)}
                    placeholder="Subtitle text"
                    className="bg-background"
                  />
                )}
              </div>

              <div className="flex shrink-0 items-center gap-0.5 pt-4">
                <EmojiButton
                  emoji={chunk.emoji}
                  lineNumber={lineNumber}
                  onChange={(emoji) =>
                    onChunksChange(setLine(chunks, c, { emoji }))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={Boolean(chunk.hidden)}
                  aria-label={
                    chunk.hidden
                      ? `Show line ${lineNumber} on the video`
                      : `Hide line ${lineNumber} on the video`
                  }
                  onClick={() =>
                    onChunksChange(setLine(chunks, c, { hidden: !chunk.hidden }))
                  }
                >
                  {chunk.hidden ? <EyeSlash /> : <Eye />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for line ${lineNumber}`}
                      />
                    }
                  >
                    <DotsThreeVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => insertAfter(c)}>
                      <Plus />
                      Insert line below
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={c === chunks.length - 1}
                      onClick={() => mergeWithNext(c)}
                    >
                      <ArrowsMerge />
                      Merge with next line
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        onChunksChange(chunks.filter((_, i) => i !== c))
                      }
                    >
                      <Trash />
                      Delete line
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WordMenu({
  chunks,
  c,
  w,
  onChunksChange,
  onOpenWord,
  onPreview,
}: {
  chunks: SubtitleChunk[];
  c: number;
  w: number;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onOpenWord: (key: string | null) => void;
  /** Plays the video from just before `seconds`, to show an animation. */
  onPreview: (seconds: number) => void;
}) {
  const textId = useId();
  const chunk = chunks[c];
  const word = chunk?.words[w];
  // Only rendered while open, so reading the platform here is safe.
  const mod =
    typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform)
      ? "⌘"
      : "Ctrl+";

  if (!chunk || !word) return null;

  const isFirst = w === 0;
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
      label: word.lineBreak ? "Remove line break" : "Add line break",
      icon: <KeyReturn />,
      keys: `${mod}B`,
      shortcut: "b",
      show: !isLast,
      run: () => onChunksChange(toggleLineBreak(chunks, c, w)),
    },
    {
      label: "Move to previous line",
      icon: <ArrowUp />,
      keys: `${mod}↑`,
      shortcut: "ArrowUp",
      show: isFirst && c > 0,
      run: () => apply(moveToPreviousLine(chunks, c)),
    },
    {
      label: "Move to next line",
      icon: <ArrowDown />,
      keys: `${mod}↓`,
      shortcut: "ArrowDown",
      show: isLast && c < chunks.length - 1,
      run: () => apply(moveToNextLine(chunks, c)),
    },
    {
      label: "Split into new line",
      icon: <Scissors />,
      keys: `${mod}L`,
      shortcut: "l",
      show: !isFirst,
      run: () => apply(splitLine(chunks, c, w)),
    },
    {
      label: "Add word after",
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

  return (
    <div
      onKeyDown={(event) => {
        if (!(event.metaKey || event.ctrlKey)) return;
        const action = visible.find(
          (a) => a.shortcut.toLowerCase() === event.key.toLowerCase(),
        );
        if (!action) return;
        event.preventDefault();
        action.run();
      }}
    >
      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Label htmlFor={textId} className="text-xs text-muted-foreground">
            Word
          </Label>
          <Input
            id={textId}
            autoFocus
            value={word.word}
            onChange={(event) =>
              onChunksChange(setWordText(chunks, c, w, event.target.value))
            }
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Animation
          </span>
          <div
            role="group"
            aria-label="Word animation"
            className="flex flex-wrap gap-1"
          >
            {WORD_EFFECTS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={word.effect === option.value}
                onClick={() => {
                  onChunksChange(setWordEffect(chunks, c, w, option.value));
                  if (option.value) onPreview(word.start);
                }}
                className="h-7 rounded-full border px-2.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                {option.label}
              </button>
            ))}
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
        {visible.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.run}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0",
              action.destructive
                ? "text-destructive"
                : "[&_svg]:text-muted-foreground",
            )}
          >
            {action.icon}
            <span className="flex-1">{action.label}</span>
            <Kbd>{action.keys}</Kbd>
          </button>
        ))}
      </div>
    </div>
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              emoji
                ? `Change emoji ${emoji} on line ${lineNumber}`
                : `Add an emoji to line ${lineNumber}`
            }
            className={cn(emoji && "bg-muted text-base")}
          />
        }
      >
        {emoji ?? <SmileyWink />}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="search"
            autoFocus
            aria-label="Search emoji"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emoji"
          />
          {emoji ? (
            <Button variant="outline" size="sm" onClick={() => pick(undefined)}>
              Remove
            </Button>
          ) : null}
        </div>
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
                    aria-pressed={char === emoji}
                    onClick={() => pick(char)}
                    className="flex aspect-square items-center justify-center rounded-md text-xl outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted"
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
