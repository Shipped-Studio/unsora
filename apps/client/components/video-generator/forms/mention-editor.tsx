"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { MusicNote } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface MentionFile {
  id: string;
  label: string;
  preview: string;
  kind: "image" | "video" | "audio";
}

interface MentionEditorProps {
  editorId: string;
  value: string;
  placeholder: string;
  label: string;
  disabled: boolean;
  files: MentionFile[];
  onChange: (text: string) => void;
  onSubmitShortcut: () => void;
}

const CHIP_CLASS =
  "mx-0.5 inline-flex cursor-default select-none items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-0.5 align-middle text-xs";

/** Builds a mention chip with DOM APIs (no HTML strings). */
function createChip(file: MentionFile, onRemove: (chip: HTMLElement) => void) {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.className = CHIP_CLASS;
  chip.setAttribute("data-mention-id", file.id);

  if (file.kind !== "audio") {
    const media = document.createElement(file.kind === "video" ? "video" : "img");
    media.className = "size-5 shrink-0 rounded-sm object-cover";
    media.setAttribute("src", file.preview);
    if (media instanceof HTMLVideoElement) {
      media.muted = true;
      media.preload = "metadata";
    } else {
      media.setAttribute("alt", "");
    }
    chip.appendChild(media);
  }

  const name = document.createElement("span");
  name.className = "pointer-events-none max-w-28 truncate font-medium";
  name.setAttribute("data-filename", file.label);
  name.textContent = file.label;
  chip.appendChild(name);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className =
    "flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground";
  remove.setAttribute("aria-label", `Remove ${file.label}`);
  remove.textContent = "×";
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    onRemove(chip);
  });
  chip.appendChild(remove);

  return chip;
}

/**
 * contentEditable prompt with "@" mentions: typing @ lists the attached files
 * and inserts the chosen one as an inline chip.
 */
export function MentionEditor({
  editorId,
  value,
  placeholder,
  label,
  disabled,
  files,
  onChange,
  onSubmitShortcut,
}: MentionEditorProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const getEditor = useCallback(
    () => document.getElementById(editorId),
    [editorId],
  );

  // Seed a fresh editor with the shared prompt (e.g. after switching models).
  const initialValue = useRef(value);
  useEffect(() => {
    const editor = getEditor();
    if (editor && initialValue.current && editor.innerText.trim() === "") {
      editor.textContent = initialValue.current;
    }
  }, [getEditor]);

  // Clear the editor when the prompt is reset (e.g. after submit).
  useEffect(() => {
    if (value !== "") return;
    const editor = getEditor();
    if (editor && editor.innerHTML !== "") editor.innerHTML = "";
  }, [value, getEditor]);

  // Keep chips in sync with the attachments: drop removed files, relabel.
  useEffect(() => {
    const editor = getEditor();
    if (!editor) return;

    let changed = false;
    editor
      .querySelectorAll<HTMLElement>("[data-mention-id]")
      .forEach((chip) => {
        const file = files.find(
          (f) => f.id === chip.getAttribute("data-mention-id"),
        );
        if (!file) {
          chip.remove();
          changed = true;
          return;
        }
        const nameEl = chip.querySelector("[data-filename]");
        if (nameEl && nameEl.getAttribute("data-filename") !== file.label) {
          nameEl.setAttribute("data-filename", file.label);
          nameEl.textContent = file.label;
          changed = true;
        }
      });

    if (changed) onChangeRef.current(editor.innerText);
  }, [files, getEditor]);

  const insertChip = useCallback(
    (file: MentionFile) => {
      const editor = getEditor();
      if (!editor) return;
      editor.focus();

      const chip = createChip(file, (el) => {
        el.remove();
        onChangeRef.current(editor.innerText);
      });

      const selection = window.getSelection();
      if (
        selection &&
        selection.rangeCount > 0 &&
        selection.anchorNode &&
        editor.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        range.insertNode(chip);
        range.setStartAfter(chip);
        range.setEndAfter(chip);
        const space = document.createTextNode(" ");
        range.insertNode(space);
        range.setStartAfter(space);
        range.setEndAfter(space);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.appendChild(chip);
        editor.appendChild(document.createTextNode(" "));
      }

      onChangeRef.current(editor.innerText);
    },
    [getEditor],
  );

  const selectMention = useCallback(
    (file: MentionFile) => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const caret = range.startOffset;
          const at = text.lastIndexOf("@", caret - 1);
          if (at !== -1) {
            range.setStart(node, at);
            range.setEnd(node, caret);
            range.deleteContents();
          }
        }
      }
      insertChip(file);
      setMentionQuery(null);
    },
    [insertChip],
  );

  const matches =
    mentionQuery !== null
      ? files.filter((f) =>
          f.label.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
      : [];
  const listId = `${editorId}-mentions`;

  return (
    <div className="relative">
      {mentionQuery !== null && (
        <div className="absolute bottom-full left-3 z-50 mb-2 max-h-52 w-60 overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Attached files
          </p>
          {matches.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Attached files">
              {matches.map((file, i) => (
                <li
                  key={file.id}
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                    i === highlight && "bg-accent",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMention(file);
                  }}
                >
                  <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
                    {file.kind === "audio" ? (
                      <MusicNote className="size-3.5 text-muted-foreground" />
                    ) : file.kind === "video" ? (
                      <video
                        src={file.preview}
                        muted
                        preload="metadata"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Image
                        src={file.preview}
                        alt=""
                        fill
                        sizes="24px"
                        unoptimized
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span className="truncate text-xs">{file.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {files.length === 0
                ? "Attach files first, then mention them with @."
                : `No files match "${mentionQuery}".`}
            </p>
          )}
        </div>
      )}

      <div
        id={editorId}
        role="textbox"
        aria-multiline
        aria-label={label}
        aria-placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={mentionQuery !== null ? listId : undefined}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="block max-h-52 min-h-20 w-full overflow-y-auto px-4 py-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] aria-disabled:opacity-50"
        onInput={(e) => {
          onChange(e.currentTarget.innerText);
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          const node = range.startContainer;
          if (node.nodeType !== Node.TEXT_NODE) {
            setMentionQuery(null);
            return;
          }
          const text = node.textContent || "";
          const caret = range.startOffset;
          const at = text.lastIndexOf("@", caret - 1);
          if (at === -1) {
            setMentionQuery(null);
            return;
          }
          const query = text.substring(at + 1, caret);
          setMentionQuery(query.includes(" ") ? null : query);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmitShortcut();
            return;
          }
          if (mentionQuery !== null) {
            if (e.key === "Escape") {
              e.preventDefault();
              setMentionQuery(null);
              return;
            }
            if (e.key === "ArrowDown" && matches.length > 0) {
              e.preventDefault();
              setHighlight((h) => (h + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp" && matches.length > 0) {
              e.preventDefault();
              setHighlight((h) => (h - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const file = matches[highlight];
              if (file) selectMention(file);
              else setMentionQuery(null);
              return;
            }
          }

          if (e.key === "Backspace") {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || !selection.isCollapsed)
              return;
            const range = selection.getRangeAt(0);
            let chip: Node | null = null;
            if (
              range.startContainer.nodeType === Node.TEXT_NODE &&
              range.startOffset === 0
            ) {
              chip = range.startContainer.previousSibling;
            } else if (
              range.startContainer.nodeType === Node.ELEMENT_NODE &&
              range.startOffset > 0
            ) {
              chip = range.startContainer.childNodes[range.startOffset - 1];
            }
            if (
              chip &&
              chip.nodeType === Node.ELEMENT_NODE &&
              (chip as Element).hasAttribute("data-mention-id")
            ) {
              e.preventDefault();
              chip.parentNode?.removeChild(chip);
              onChange(e.currentTarget.innerText);
            }
          }
        }}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
        onPaste={(e) => {
          // Pasted files bubble up to the composer, which attaches them.
          if (Array.from(e.clipboardData.items).some((item) => item.kind === "file")) {
            return;
          }
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          onChange(e.currentTarget.innerText);
        }}
      />
    </div>
  );
}
