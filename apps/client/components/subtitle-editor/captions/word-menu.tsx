"use client";

import { useId, useState } from "react";
import {
  ArrowUp,
  CaretRight,
  KeyReturn,
  MusicNotes,
  Plus,
  Trash,
} from "@phosphor-icons/react";
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
  type KeywordLevel,
  type WordSound,
} from "@/components/subtitle-editor/caption-style";
import { useCaptionsEditor } from "@/components/subtitle-editor/captions/captions-context";
import { wordKey } from "@/components/subtitle-editor/captions/shared";
import { SoundPlayButton, playSound } from "@/components/subtitle-editor/sound-preview";
import {
  addWordAfter,
  moveToPreviousLine,
  removeWord,
  setWordKeyword,
  setWordText,
  setWordTiming,
  splitLine,
  withWordSound,
} from "@/components/subtitle-editor/chunk-edits";
import { cn } from "@/lib/utils";
import type { SubtitleChunk } from "@/remotion/types";

/** Highlight levels, with the key that sets each one (⌘/Ctrl + key). */
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

interface WordProps {
  lineIndex: number;
  wordIndex: number;
  /** Opens another word's menu (by key), or closes the menu (null). */
  onOpenWord: (key: string | null) => void;
}

/**
 * A word edited in place: type to change it, Enter to save, Escape to undo.
 * Clicking it also opens the word menu.
 */
export function EditableWord({
  lineIndex,
  wordIndex,
  onOpenWord,
  open,
  onOpenChange,
  highlight,
  match,
}: WordProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The highlight color, when the word is a keyword. */
  highlight?: string;
  /** The word matches Find and replace. */
  match: boolean;
}) {
  const { chunks, onChunksChange } = useCaptionsEditor();
  const word = chunks[lineIndex].words[wordIndex];
  const shortcuts = useWordShortcuts({ lineIndex, wordIndex, onOpenWord });

  /** Saves the typed text; an emptied word is removed. */
  const commit = (element: HTMLElement) => {
    const text = (element.textContent ?? "").trim();
    if (text === word.word) return;
    if (!text) {
      onChunksChange(removeWord(chunks, lineIndex, wordIndex));
      onOpenWord(null);
      return;
    }
    onChunksChange(setWordText(chunks, lineIndex, wordIndex, text));
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
        <WordMenu lineIndex={lineIndex} wordIndex={wordIndex} onOpenWord={onOpenWord} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The word menu's keyboard shortcuts (⌘/Ctrl + key), shared by the word
 * and the menu so they work wherever focus is.
 */
function useWordShortcuts({ lineIndex, wordIndex, onOpenWord }: WordProps) {
  const { chunks, onChunksChange } = useCaptionsEditor();

  return (event: React.KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    const isLastWord = wordIndex === chunks[lineIndex].words.length - 1;
    const highlight = HIGHLIGHTS.find((h) => h.key === key);

    /** Applies an edit that moves the word elsewhere, then closes the menu. */
    const moveAndClose = (next: SubtitleChunk[]) => {
      onOpenWord(null);
      onChunksChange(next);
    };

    let run: (() => void) | null = null;
    if (highlight) {
      run = () => onChunksChange(setWordKeyword(chunks, lineIndex, wordIndex, highlight.value));
    } else if (key === "b" && !isLastWord) {
      run = () => moveAndClose(splitLine(chunks, lineIndex, wordIndex + 1));
    } else if (key === "arrowup" && lineIndex > 0) {
      run = () => moveAndClose(moveToPreviousLine(chunks, lineIndex, wordIndex));
    } else if (key === "i") {
      run = () => {
        onChunksChange(addWordAfter(chunks, lineIndex, wordIndex));
        onOpenWord(wordKey(lineIndex, wordIndex + 1));
      };
    } else if (key === "d") {
      run = () => moveAndClose(removeWord(chunks, lineIndex, wordIndex));
    }
    if (!run) return;
    event.preventDefault();
    run();
  };
}

/** The word menu: highlight color, timing, sound, and word actions. */
function WordMenu({ lineIndex, wordIndex, onOpenWord }: WordProps) {
  const { chunks, onChunksChange, preset } = useCaptionsEditor();
  const [soundsOpen, setSoundsOpen] = useState(false);
  const shortcuts = useWordShortcuts({ lineIndex, wordIndex, onOpenWord });
  const line = chunks[lineIndex];
  const word = line?.words[wordIndex];
  // Only rendered while open, so reading the platform here is safe.
  const mod =
    typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform)
      ? "⌘"
      : "Ctrl+";

  if (!line || !word) return null;

  const isLastWord = wordIndex === line.words.length - 1;

  /** Applies an edit that moves the word elsewhere, then closes the menu. */
  const moveAndClose = (next: SubtitleChunk[]) => {
    onOpenWord(null);
    onChunksChange(next);
  };

  const actions: {
    label: string;
    icon: React.ReactNode;
    keys: string;
    show: boolean;
    destructive?: boolean;
    run: () => void;
  }[] = [
    {
      label: "Add line break",
      icon: <KeyReturn />,
      keys: `${mod}B`,
      show: !isLastWord,
      run: () => moveAndClose(splitLine(chunks, lineIndex, wordIndex + 1)),
    },
    {
      label: "Move to prev line",
      icon: <ArrowUp />,
      keys: `${mod}↑`,
      show: lineIndex > 0,
      run: () => moveAndClose(moveToPreviousLine(chunks, lineIndex, wordIndex)),
    },
    {
      label: "Add word",
      icon: <Plus />,
      keys: `${mod}I`,
      show: true,
      run: () => {
        onChunksChange(addWordAfter(chunks, lineIndex, wordIndex));
        onOpenWord(wordKey(lineIndex, wordIndex + 1));
      },
    },
    {
      label: "Remove word",
      icon: <Trash />,
      keys: `${mod}D`,
      show: true,
      destructive: true,
      run: () => moveAndClose(removeWord(chunks, lineIndex, wordIndex)),
    },
  ];
  const visible = actions.filter((action) => action.show);

  const setHighlight = (level: KeywordLevel | undefined) =>
    onChunksChange(setWordKeyword(chunks, lineIndex, wordIndex, level));

  const setSound = (sound: WordSound | undefined) => {
    onChunksChange(withWordSound(chunks, lineIndex, wordIndex, sound));
    setSoundsOpen(false);
    if (sound) playSound(sound);
  };

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
              onChunksChange(setWordTiming(chunks, lineIndex, wordIndex, { start }))
            }
          />
          <TimeField
            label="End"
            value={word.end}
            onCommit={(end) =>
              onChunksChange(setWordTiming(chunks, lineIndex, wordIndex, { end }))
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
              {[{ value: undefined, label: "No sound" }, ...WORD_SOUNDS].map((sound) => (
                <div key={sound.label} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-pressed={word.sound === sound.value}
                    onClick={() => setSound(sound.value as WordSound | undefined)}
                    className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted aria-pressed:font-medium aria-pressed:text-primary"
                  >
                    {sound.label}
                  </button>
                  {sound.value ? (
                    <SoundPlayButton id={sound.value} label={sound.label} />
                  ) : null}
                </div>
              ))}
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
