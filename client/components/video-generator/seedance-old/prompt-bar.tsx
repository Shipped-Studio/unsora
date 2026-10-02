// "use client";

// import { useState, useEffect, useMemo } from "react";
// import {
//   FileAudio,
//   Sparkles,
//   Loader2,
//   Coins,
//   AlertTriangle,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import {
//   Tooltip,
//   TooltipTrigger,
//   TooltipContent,
// } from "@/components/ui/tooltip";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";

// export interface PromptFileItem {
//   file: File;
//   preview: string;
//   type: "image" | "video" | "audio";
//   duration?: number;
// }

// interface PromptBarProps {
//   files: PromptFileItem[];
//   prompt: string;
//   setPrompt: (prompt: string) => void;
//   model: string;
//   setModel: (model: string) => void;
//   mode: string;
//   setMode: (mode: string) => void;
//   ratio: string;
//   setRatio: (ratio: string) => void;
//   duration: string;
//   setDuration: (duration: string) => void;
//   onGenerate: () => void;
//   isGenerating: boolean;
// }

// function getFileLabel(file: PromptFileItem, files: PromptFileItem[]): string {
//   const sameType = files.filter((f) => f.type === file.type);
//   const index = sameType.indexOf(file) + 1;
//   return `${file.type}_file_${index}`;
// }

// const CREDIT_TABLE: Record<string, Record<string, [number, number, number]>> = {
//   //                          [0-5s, 6-10s, 10-15s]
//   "seedance_2.0_fast": { no_video: [20, 40, 60], video: [40, 80, 100] },
//   "seedance_2.0": { no_video: [40, 80, 100], video: [80, 140, 200] },
// };

// function calculateCredits(
//   model: string,
//   duration: number,
//   hasVideoInput: boolean,
// ): number {
//   const entry = CREDIT_TABLE[model] ?? CREDIT_TABLE["seedance_2.0_fast"];
//   const tier = hasVideoInput ? entry.video : entry.no_video;
//   if (duration <= 5) return tier[0];
//   if (duration <= 10) return tier[1];
//   return tier[2];
// }

// export function PromptBar({
//   files,
//   prompt: _prompt,
//   setPrompt,
//   model,
//   setModel,
//   mode,
//   setMode,
//   ratio,
//   setRatio,
//   duration,
//   setDuration,
//   onGenerate,
//   isGenerating,
// }: PromptBarProps) {
//   const [mentionQuery, setMentionQuery] = useState<string | null>(null);
//   const [mentionedFiles, setMentionedFiles] = useState<string[]>([]);

//   const hasVideoInput = files.some((f) => f.type === "video");
//   const creditCost = useMemo(
//     () => calculateCredits(model, Number(duration), hasVideoInput),
//     [model, duration, hasVideoInput],
//   );

//   const insertChip = (
//     label: string,
//     realFilename: string,
//     preview: string,
//     type: "image" | "video" | "audio",
//   ) => {
//     const editor = document.getElementById("seedance-prompt-editor");
//     if (!editor) return;

//     editor.focus();

//     const chip = document.createElement("span");
//     chip.contentEditable = "false";
//     chip.className =
//       "inline-flex items-center gap-1.5 rounded-md bg-white border border-zinc-200 pl-1 pr-2 py-0.5 mx-1 align-middle select-none shadow-sm cursor-default";
//     chip.setAttribute("data-real-filename", realFilename);
//     chip.innerHTML = `
//       <span class="relative flex h-5 w-5 rounded overflow-hidden bg-zinc-100 shrink-0">
//         ${
//           type === "video"
//             ? `<video src="${preview}" class="h-full w-full object-cover" muted preload="metadata"></video>`
//             : type === "image"
//               ? `<img src="${preview}" class="h-full w-full object-cover" />`
//               : `<span class="h-full w-full flex items-center justify-center text-[9px] text-zinc-400">🎵</span>`
//         }
//       </span>
//       <span class="text-[11px] font-medium text-zinc-900 max-w-[100px] truncate leading-none pointer-events-none" data-filename="${label}">${label}</span>
//       <span class="h-3.5 w-3.5 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 cursor-pointer pointer-events-auto" onclick="this.parentNode.remove()">
//         <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
//       </span>
//     `;

//     const selection = window.getSelection();
//     if (
//       selection &&
//       selection.rangeCount > 0 &&
//       selection.anchorNode &&
//       editor.contains(selection.anchorNode)
//     ) {
//       const range = selection.getRangeAt(0);
//       range.insertNode(chip);
//       range.setStartAfter(chip);
//       range.setEndAfter(chip);
//       const space = document.createTextNode("\u00A0");
//       range.insertNode(space);
//       range.setStartAfter(space);
//       range.setEndAfter(space);
//       selection.removeAllRanges();
//       selection.addRange(range);
//     } else {
//       editor.appendChild(chip);
//       editor.appendChild(document.createTextNode("\u00A0"));
//     }

//     setPrompt(editor.innerText);
//     if (!mentionedFiles.includes(label)) {
//       setMentionedFiles((prev) => [...prev, label]);
//     }
//   };

//   const handleMentionSelect = (file: PromptFileItem) => {
//     const editor = document.getElementById("seedance-prompt-editor");
//     if (editor) {
//       const selection = window.getSelection();
//       if (selection && selection.rangeCount > 0) {
//         const range = selection.getRangeAt(0);
//         const textNode = range.startContainer;
//         if (textNode.nodeType === Node.TEXT_NODE) {
//           const textContent = textNode.textContent || "";
//           const caretPos = range.startOffset;
//           const lastAt = textContent.lastIndexOf("@", caretPos - 1);
//           if (lastAt !== -1) {
//             range.setStart(textNode, lastAt);
//             range.setEnd(textNode, caretPos);
//             range.deleteContents();
//           }
//         }
//       }
//     }
//     insertChip(
//       getFileLabel(file, files),
//       file.file.name,
//       file.preview,
//       file.type,
//     );
//     setMentionQuery(null);
//   };

//   const filteredFiles =
//     mentionQuery !== null
//       ? files.filter((f) =>
//           getFileLabel(f, files)
//             .toLowerCase()
//             .includes(mentionQuery.toLowerCase()),
//         )
//       : [];

//   useEffect(() => {
//     const editor = document.getElementById("seedance-prompt-editor");
//     if (!editor) return;

//     const chips = editor.querySelectorAll<HTMLElement>("[data-real-filename]");
//     const currentRealNames = new Set(files.map((f) => f.file.name));
//     let changed = false;

//     chips.forEach((chip) => {
//       const realName = chip.getAttribute("data-real-filename");
//       if (!realName || !currentRealNames.has(realName)) {
//         chip.remove();
//         changed = true;
//         return;
//       }
//       const file = files.find((f) => f.file.name === realName);
//       if (!file) return;
//       const newLabel = getFileLabel(file, files);
//       const labelEl = chip.querySelector("[data-filename]");
//       if (labelEl && labelEl.getAttribute("data-filename") !== newLabel) {
//         labelEl.setAttribute("data-filename", newLabel);
//         labelEl.textContent = newLabel;
//         changed = true;
//       }
//     });

//     if (changed) {
//       setPrompt(editor.innerText);
//       const remainingNames = Array.from(
//         editor.querySelectorAll<HTMLElement>("[data-real-filename]"),
//       )
//         .map((chip) => {
//           const realName = chip.getAttribute("data-real-filename");
//           const file = files.find((f) => f.file.name === realName);
//           return file ? getFileLabel(file, files) : null;
//         })
//         .filter(Boolean) as string[];
//       setMentionedFiles(remainingNames);
//     }
//   }, [files, setPrompt]);

//   const promptLength = _prompt.trim().length;
//   const isStrongWarning = promptLength > 1600;
//   const isWarning = promptLength > 1400 && promptLength <= 1600;

//   return (
//     <div className="relative rounded-lg border-2 border-foreground bg-card overflow-visible">
//       {/* Mention suggestions popup — appears above the bar */}
//       {mentionQuery !== null && (
//         <div className="absolute bottom-full left-4 mb-2 w-60 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl z-50 p-1">
//           <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1.5 border-b border-border/50 mb-1 uppercase tracking-wider">
//             Reference Media
//           </div>
//           {filteredFiles.length > 0 ? (
//             filteredFiles.map((file, idx) => (
//               <button
//                 key={idx}
//                 className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent cursor-pointer transition-colors text-left"
//                 onMouseDown={(e) => {
//                   e.preventDefault();
//                   handleMentionSelect(file);
//                 }}
//               >
//                 <div className="h-6 w-6 rounded overflow-hidden bg-zinc-100 shrink-0">
//                   {file.type === "audio" ? (
//                     <div className="h-full w-full flex items-center justify-center bg-zinc-200">
//                       <FileAudio className="h-3 w-3 text-muted-foreground" />
//                     </div>
//                   ) : file.type === "video" ? (
//                     <video
//                       src={file.preview}
//                       muted
//                       preload="metadata"
//                       className="h-full w-full object-cover"
//                     />
//                   ) : (
//                     <img
//                       src={file.preview}
//                       alt=""
//                       className="h-full w-full object-cover"
//                     />
//                   )}
//                 </div>
//                 <span className="truncate text-xs">
//                   {getFileLabel(file, files)}
//                 </span>
//               </button>
//             ))
//           ) : (
//             <div className="px-2 py-3 text-center text-xs text-muted-foreground">
//               No media matching &ldquo;{mentionQuery}&rdquo;
//             </div>
//           )}
//         </div>
//       )}

//       {/* Prompt textarea */}
//       <div
//         className="px-4 pt-3 pb-2 cursor-text"
//         onClick={() =>
//           document.getElementById("seedance-prompt-editor")?.focus()
//         }
//       >
//         <div
//           id="seedance-prompt-editor"
//           contentEditable
//           suppressContentEditableWarning
//           className="outline-none text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground min-h-[42px] max-h-[120px] overflow-y-auto"
//           data-placeholder="Describe your video... type @ to reference uploaded files"
//           onInput={(e) => {
//             const target = e.currentTarget;
//             setPrompt(target.innerText);

//             const selection = window.getSelection();
//             if (selection && selection.rangeCount > 0) {
//               const range = selection.getRangeAt(0);
//               const textNode = range.startContainer;
//               if (textNode.nodeType === Node.TEXT_NODE) {
//                 const textContent = textNode.textContent || "";
//                 const caretPos = range.startOffset;
//                 const lastAt = textContent.lastIndexOf("@", caretPos - 1);
//                 if (lastAt !== -1) {
//                   const query = textContent.substring(lastAt + 1, caretPos);
//                   setMentionQuery(query.includes(" ") ? null : query);
//                 } else {
//                   setMentionQuery(null);
//                 }
//               }
//             }
//           }}
//           onKeyDown={(e) => {
//             if (e.key === "Enter" && mentionQuery !== null) e.preventDefault();
//             if (e.key === "Escape") setMentionQuery(null);

//             if (e.key === "Backspace") {
//               const selection = window.getSelection();
//               if (
//                 selection &&
//                 selection.rangeCount > 0 &&
//                 selection.isCollapsed
//               ) {
//                 const range = selection.getRangeAt(0);
//                 let nodeToRemove: Node | null = null;

//                 if (
//                   range.startContainer.nodeType === Node.TEXT_NODE &&
//                   range.startOffset === 0
//                 ) {
//                   const prev = range.startContainer.previousSibling;
//                   if (
//                     prev &&
//                     prev.nodeType === Node.ELEMENT_NODE &&
//                     (prev as Element).classList.contains("inline-flex")
//                   ) {
//                     nodeToRemove = prev;
//                   }
//                 } else if (
//                   range.startContainer.nodeType === Node.ELEMENT_NODE &&
//                   range.startOffset > 0
//                 ) {
//                   const child =
//                     range.startContainer.childNodes[range.startOffset - 1];
//                   if (
//                     child &&
//                     child.nodeType === Node.ELEMENT_NODE &&
//                     (child as Element).classList.contains("inline-flex")
//                   ) {
//                     nodeToRemove = child;
//                   }
//                 }

//                 if (nodeToRemove) {
//                   e.preventDefault();
//                   const filename = (nodeToRemove as Element)
//                     .querySelector("[data-filename]")
//                     ?.getAttribute("data-filename");
//                   nodeToRemove.parentNode?.removeChild(nodeToRemove);
//                   if (filename) {
//                     setMentionedFiles((prev) =>
//                       prev.filter((f) => f !== filename),
//                     );
//                   }
//                   setPrompt(e.currentTarget.innerText);
//                 }
//               }
//             }
//           }}
//           onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
//           onPaste={(e) => {
//             e.preventDefault();
//             const text = e.clipboardData.getData("text/plain");
//             const selection = window.getSelection();
//             if (selection && selection.rangeCount > 0) {
//               const range = selection.getRangeAt(0);
//               range.deleteContents();
//               range.insertNode(document.createTextNode(text));
//               range.collapse(false);
//               selection.removeAllRanges();
//               selection.addRange(range);
//             }
//             setPrompt(e.currentTarget.innerText);
//           }}
//         />
//       </div>

//       {/* Prompt length warnings */}
//       {isWarning && (
//         <div className="mx-3 mb-1 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
//           <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
//           <div>
//             <span className="font-semibold">
//               {promptLength.toLocaleString()}+ chars (warning)
//             </span>
//             <p className="mt-0.5 text-amber-600 dark:text-amber-400/80">
//               Longer prompts can increase generation time and may be more likely
//               to time out. Consider shortening or simplifying your prompt.
//             </p>
//           </div>
//         </div>
//       )}

//       {isStrongWarning && (
//         <div className="mx-3 mb-1 flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
//           <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
//           <div>
//             <span className="font-semibold">
//               {promptLength.toLocaleString()}+ chars (strong warning)
//             </span>
//             <p className="mt-0.5 font-medium">High timeout risk</p>
//             <p className="mt-0.5 text-orange-600 dark:text-orange-400/80">
//               Very long prompts are more likely to fail or time out. For better
//               reliability, shorten your prompt or break it into multiple
//               generations.
//             </p>
//           </div>
//         </div>
//       )}

//       {/* Options + Generate row */}
//       <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5">
//         <Select value={model} onValueChange={setModel}>
//           <SelectTrigger className="h-7 w-auto text-xs border-border bg-transparent min-w-[148px]">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="seedance_2.0_fast">seedance_2.0_fast</SelectItem>
//             <SelectItem value="seedance_2.0">seedance_2.0</SelectItem>
//           </SelectContent>
//         </Select>

//         <Select value={mode} onValueChange={setMode}>
//           <SelectTrigger className="h-7 w-auto text-xs border-border bg-transparent min-w-[148px]">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="omni_reference">omni_reference</SelectItem>
//             <SelectItem value="first_last_frames">first_last_frames</SelectItem>
//           </SelectContent>
//         </Select>

//         <Select value={ratio} onValueChange={setRatio}>
//           <SelectTrigger className="h-7 w-auto text-xs border-border bg-transparent min-w-[68px]">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="21:9">21:9</SelectItem>
//             <SelectItem value="16:9">16:9</SelectItem>
//             <SelectItem value="4:3">4:3</SelectItem>
//             <SelectItem value="1:1">1:1</SelectItem>
//             <SelectItem value="3:4">3:4</SelectItem>
//             <SelectItem value="9:16">9:16</SelectItem>
//           </SelectContent>
//         </Select>

//         <Select value={duration} onValueChange={setDuration}>
//           <SelectTrigger className="h-7 w-auto text-xs border-border bg-transparent min-w-[60px]">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             {Array.from({ length: 12 }, (_, i) => i + 4).map((s) => (
//               <SelectItem key={s} value={String(s)}>
//                 {s}s
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>

//         <div className="flex-1" />

//         <Tooltip>
//           <TooltipTrigger>
//             <Button
//               onClick={onGenerate}
//               disabled={isGenerating}
//               className="ml-auto"
//             >
//               {isGenerating ? (
//                 <Loader2 className="h-3 w-3 animate-spin" />
//               ) : (
//                 <Sparkles className="h-3 w-3" />
//               )}
//               {isGenerating ? "Generating..." : "Generate"}
//               <span className="ml-1 flex items-center gap-0.5 text-[10px] opacity-70">
//                 <Coins className="h-3 w-3" />
//                 {creditCost}
//               </span>
//             </Button>
//           </TooltipTrigger>
//           <TooltipContent side="top">
//             This generation will cost {creditCost}{" "}
//             {creditCost === 1 ? "credit" : "credits"}
//           </TooltipContent>
//         </Tooltip>
//       </div>
//     </div>
//   );
// }
