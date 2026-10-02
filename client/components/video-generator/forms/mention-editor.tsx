"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { MusicNote } from "@phosphor-icons/react";

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
  disabled: boolean;
  files: MentionFile[];
  onChange: (text: string) => void;
  onSubmitShortcut: () => void;
}

/**
 * contentEditable prompt editor with "@" mention support: typing @ opens a
 * picker of uploaded files which are inserted as inline chips.
 */
export function MentionEditor({
  editorId,
  value,
  placeholder,
  disabled,
  files,
  onChange,
  onSubmitShortcut,
}: MentionEditorProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // Clear contentEditable when prompt is reset (e.g. after submit)
  useEffect(() => {
    if (value === "") {
      const editor = document.getElementById(editorId);
      if (editor && editor.innerHTML !== "") {
        editor.innerHTML = "";
      }
    }
  }, [value, editorId]);

  // Sync chips when files change (remove stale chips, update labels)
  useEffect(() => {
    const editor = document.getElementById(editorId);
    if (!editor) return;

    const chips = editor.querySelectorAll<HTMLElement>("[data-mention-id]");
    let changed = false;

    chips.forEach((chip) => {
      const id = chip.getAttribute("data-mention-id");
      const file = files.find((f) => f.id === id);
      if (!file) {
        chip.remove();
        changed = true;
        return;
      }
      const labelEl = chip.querySelector("[data-filename]");
      if (labelEl && labelEl.getAttribute("data-filename") !== file.label) {
        labelEl.setAttribute("data-filename", file.label);
        labelEl.textContent = file.label;
        changed = true;
      }
    });

    if (changed) onChange(editor.innerText);
  }, [files, editorId, onChange]);

  const insertChip = useCallback(
    (file: MentionFile) => {
      const editor = document.getElementById(editorId);
      if (!editor) return;
      editor.focus();

      const chip = document.createElement("span");
      chip.contentEditable = "false";
      chip.className =
        "inline-flex items-center gap-1.5 rounded-md bg-muted border border-border pl-1 pr-2 py-0.5 mx-1 align-middle select-none shadow-sm cursor-default";
      chip.setAttribute("data-mention-id", file.id);
      chip.innerHTML = `
        <span class="relative flex h-5 w-5 rounded overflow-hidden bg-muted shrink-0">
          ${
            file.kind === "video"
              ? `<video src="${file.preview}" class="h-full w-full object-cover" muted preload="metadata"></video>`
              : file.kind === "image"
                ? `<img src="${file.preview}" class="h-full w-full object-cover" />`
                : `<span class="h-full w-full flex items-center justify-center text-[9px] text-muted-foreground">🎵</span>`
          }
        </span>
        <span class="text-[11px] font-medium text-foreground max-w-[100px] truncate leading-none pointer-events-none" data-filename="${file.label}">${file.label}</span>
        <span class="h-3.5 w-3.5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive cursor-pointer pointer-events-auto" onclick="this.parentNode.remove()">
          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </span>
      `;

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
        const space = document.createTextNode(" ");
        range.insertNode(space);
        range.setStartAfter(space);
        range.setEndAfter(space);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.appendChild(chip);
        editor.appendChild(document.createTextNode(" "));
      }

      onChange(editor.innerText);
    },
    [editorId, onChange],
  );

  const handleMentionSelect = useCallback(
    (file: MentionFile) => {
      const editor = document.getElementById(editorId);
      if (editor) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const textNode = range.startContainer;
          if (textNode.nodeType === Node.TEXT_NODE) {
            const textContent = textNode.textContent || "";
            const caretPos = range.startOffset;
            const lastAt = textContent.lastIndexOf("@", caretPos - 1);
            if (lastAt !== -1) {
              range.setStart(textNode, lastAt);
              range.setEnd(textNode, caretPos);
              range.deleteContents();
            }
          }
        }
      }
      insertChip(file);
      setMentionQuery(null);
    },
    [editorId, insertChip],
  );

  const filteredFiles =
    mentionQuery !== null
      ? files.filter((f) =>
          f.label.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
      : [];

  return (
    <div className="relative">
      {/* Mention suggestions popup */}
      {mentionQuery !== null && (
        <div className="absolute bottom-full left-0 mb-2 w-60 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl z-50 p-1">
          <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1.5 border-b border-border/50 mb-1 uppercase tracking-wider">
            Reference Media
          </div>
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file) => (
              <button
                key={file.id}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent cursor-pointer transition-colors text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMentionSelect(file);
                }}
              >
                <div className="h-6 w-6 rounded overflow-hidden bg-muted shrink-0 relative">
                  {file.kind === "audio" ? (
                    <div className="h-full w-full flex items-center justify-center bg-muted">
                      <MusicNote className="size-3 text-muted-foreground" />
                    </div>
                  ) : file.kind === "video" ? (
                    <video
                      src={file.preview}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={file.preview}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </div>
                <span className="truncate text-xs">{file.label}</span>
              </button>
            ))
          ) : (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No media matching &ldquo;{mentionQuery}&rdquo;
            </div>
          )}
        </div>
      )}

      <div
        className="cursor-text"
        onClick={() => document.getElementById(editorId)?.focus()}
      >
        <div
          id={editorId}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="outline-none text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/70 min-h-[60px] max-h-[200px] overflow-y-auto"
          data-placeholder={placeholder}
          onInput={(e) => {
            const target = e.currentTarget;
            onChange(target.innerText);

            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const textNode = range.startContainer;
              if (textNode.nodeType === Node.TEXT_NODE) {
                const textContent = textNode.textContent || "";
                const caretPos = range.startOffset;
                const lastAt = textContent.lastIndexOf("@", caretPos - 1);
                if (lastAt !== -1) {
                  const query = textContent.substring(lastAt + 1, caretPos);
                  setMentionQuery(query.includes(" ") ? null : query);
                } else {
                  setMentionQuery(null);
                }
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && mentionQuery !== null) e.preventDefault();
            if (e.key === "Escape") setMentionQuery(null);
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmitShortcut();
              return;
            }

            if (e.key === "Backspace") {
              const selection = window.getSelection();
              if (
                selection &&
                selection.rangeCount > 0 &&
                selection.isCollapsed
              ) {
                const range = selection.getRangeAt(0);
                let nodeToRemove: Node | null = null;

                if (
                  range.startContainer.nodeType === Node.TEXT_NODE &&
                  range.startOffset === 0
                ) {
                  const prev = range.startContainer.previousSibling;
                  if (
                    prev &&
                    prev.nodeType === Node.ELEMENT_NODE &&
                    (prev as Element).hasAttribute("data-mention-id")
                  ) {
                    nodeToRemove = prev;
                  }
                } else if (
                  range.startContainer.nodeType === Node.ELEMENT_NODE &&
                  range.startOffset > 0
                ) {
                  const child =
                    range.startContainer.childNodes[range.startOffset - 1];
                  if (
                    child &&
                    child.nodeType === Node.ELEMENT_NODE &&
                    (child as Element).hasAttribute("data-mention-id")
                  ) {
                    nodeToRemove = child;
                  }
                }

                if (nodeToRemove) {
                  e.preventDefault();
                  nodeToRemove.parentNode?.removeChild(nodeToRemove);
                  onChange(e.currentTarget.innerText);
                }
              }
            }
          }}
          onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
          onPaste={(e) => {
            // Let the parent handle pasted files (e.g. images from clipboard)
            if (
              Array.from(e.clipboardData.items).some((item) =>
                item.type.startsWith("image/"),
              )
            ) {
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
    </div>
  );
}
