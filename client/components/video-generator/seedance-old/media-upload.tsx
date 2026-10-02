// "use client";

// import { useRef } from "react";
// import { ImageIcon, Video, Music, X, Loader2 } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { uploadFileToStorage } from "@/lib/storage-client";
// import { toast } from "sonner";

// export interface FileSlot {
//   file: File;
//   preview: string;
//   blobUrl?: string;
//   uploading: boolean;
//   progress: number;
//   error?: string;
//   duration?: number;
// }

// export interface MediaSlots {
//   images: FileSlot[];
//   videos: FileSlot[];
//   audios: FileSlot[];
//   firstFrame: FileSlot | null;
//   lastFrame: FileSlot | null;
// }

// const MAX_IMAGES = 9;
// const MAX_VIDEOS = 3;
// const MAX_AUDIOS = 3;
// const MAX_MEDIA_DURATION = 15;

// /* ── Upload button (top row) ── */

// interface UploadButtonProps {
//   label: string;
//   accept: string;
//   icon: React.ReactNode;
//   count: number;
//   max: number;
//   multiple?: boolean;
//   onUpload: (files: File[]) => void;
// }

// function UploadButton({
//   label,
//   accept,
//   icon,
//   count,
//   max,
//   multiple,
//   onUpload,
// }: UploadButtonProps) {
//   const inputRef = useRef<HTMLInputElement>(null);
//   const isFull = count >= max;

//   return (
//     <button
//       type="button"
//       disabled={isFull}
//       onClick={() => inputRef.current?.click()}
//       className={cn(
//         "flex-1 min-w-[140px] h-24 rounded-xl border border-dashed border-foreground/20",
//         "flex flex-col items-center justify-center gap-2 bg-card transition-all",
//         !isFull && "cursor-pointer hover:border-primary hover:bg-accent",
//         isFull && "opacity-40 cursor-not-allowed",
//       )}
//     >
//       <div className="p-2.5 rounded-full bg-muted/50 text-muted-foreground">
//         {icon}
//       </div>
//       <div className="flex items-center gap-1.5">
//         <span className="text-xs font-medium text-foreground/70">{label}</span>
//         <span className="text-[10px] text-muted-foreground">
//           {count}/{max}
//         </span>
//       </div>
//       <input
//         ref={inputRef}
//         type="file"
//         accept={accept}
//         multiple={multiple}
//         className="hidden"
//         onChange={(e) => {
//           const files = e.target.files;
//           if (!files || files.length === 0) return;
//           const remaining = max - count;
//           const toAdd = Array.from(files).slice(0, remaining);
//           if (toAdd.length > 0) onUpload(toAdd);
//           e.target.value = "";
//         }}
//       />
//     </button>
//   );
// }

// /* ── Progress ring overlay ── */

// function UploadOverlay({ progress }: { progress: number }) {
//   return (
//     <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
//       {progress < 100 ? (
//         <div className="flex flex-col items-center gap-0.5">
//           <Loader2 className="h-4 w-4 text-white animate-spin" />
//           <span className="text-[9px] text-white font-medium">{progress}%</span>
//         </div>
//       ) : (
//         <Loader2 className="h-4 w-4 text-white animate-spin" />
//       )}
//     </div>
//   );
// }

// function ErrorBadge() {
//   return (
//     <div className="absolute top-0.5 left-0.5 px-1 py-px rounded bg-red-500/90 z-10">
//       <span className="text-[7px] font-bold text-white">FAILED</span>
//     </div>
//   );
// }

// /* ── Thumbnail previews ── */

// function ImageThumb({ slot, label, onRemove }: { slot: FileSlot; label: string; onRemove: () => void }) {
//   return (
//     <div className="group relative h-16 w-16 rounded-lg overflow-hidden border border-foreground/15 shrink-0">
//       <img src={slot.preview} alt={label} className="h-full w-full object-cover" />
//       {slot.uploading && <UploadOverlay progress={slot.progress} />}
//       {slot.error && <ErrorBadge />}
//       <div className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-linear-to-t from-black/70 to-transparent">
//         <p className="text-[7px] font-medium text-white/80 truncate">{label}</p>
//       </div>
//       <button
//         onClick={onRemove}
//         className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-20"
//       >
//         <X className="h-2 w-2" />
//       </button>
//     </div>
//   );
// }

// function VideoThumb({ slot, label, onRemove }: { slot: FileSlot; label: string; onRemove: () => void }) {
//   return (
//     <div className="group relative h-16 w-24 rounded-lg overflow-hidden border border-foreground/15 shrink-0">
//       <video src={slot.preview} className="h-full w-full object-cover" muted loop autoPlay playsInline />
//       {slot.uploading && <UploadOverlay progress={slot.progress} />}
//       {slot.error && <ErrorBadge />}
//       <div className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-linear-to-t from-black/70 to-transparent">
//         <p className="text-[8px] font-medium text-white/80 truncate">{label}</p>
//       </div>
//       <button
//         onClick={onRemove}
//         className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-20"
//       >
//         <X className="h-2 w-2" />
//       </button>
//     </div>
//   );
// }

// function AudioThumb({ slot, label, onRemove }: { slot: FileSlot; label: string; onRemove: () => void }) {
//   return (
//     <div className="group relative h-16 w-24 rounded-lg overflow-hidden border border-foreground/15 shrink-0 bg-linear-to-br from-zinc-900 to-zinc-800">
//       <div className="h-full w-full flex flex-col items-center justify-center gap-1">
//         <Music className="h-3.5 w-3.5 text-zinc-400" />
//         <p className="text-[8px] text-zinc-400 truncate max-w-[90%] px-1 text-center">{label}</p>
//       </div>
//       {slot.uploading && <UploadOverlay progress={slot.progress} />}
//       {slot.error && <ErrorBadge />}
//       <button
//         onClick={onRemove}
//         className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-20"
//       >
//         <X className="h-2 w-2" />
//       </button>
//     </div>
//   );
// }

// /* ── Single-file slot (first_last_frames mode) ── */

// interface CompactSlotProps {
//   label: string;
//   accept: string;
//   slot: FileSlot | null;
//   onUpload: (file: File) => void;
//   onRemove: () => void;
//   icon: React.ReactNode;
// }

// function CompactSlot({ label, accept, slot, onUpload, onRemove, icon }: CompactSlotProps) {
//   const inputRef = useRef<HTMLInputElement>(null);

//   if (slot) {
//     return (
//       <div className="group relative h-20 w-28 rounded-lg overflow-hidden border border-foreground/20 shrink-0">
//         <img src={slot.preview} alt={slot.file.name} className="h-full w-full object-cover" />
//         {slot.uploading && <UploadOverlay progress={slot.progress} />}
//         {slot.error && <ErrorBadge />}
//         <button
//           onClick={onRemove}
//           className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-20"
//         >
//           <X className="h-2.5 w-2.5" />
//         </button>
//         <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-linear-to-t from-black/70 to-transparent">
//           <p className="text-[9px] font-semibold text-white/90 uppercase tracking-wide truncate">{label}</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <button
//       type="button"
//       onClick={() => inputRef.current?.click()}
//       className={cn(
//         "h-20 w-28 shrink-0 rounded-lg border border-dashed border-foreground/20",
//         "flex flex-col items-center justify-center gap-1.5 bg-card",
//         "cursor-pointer hover:border-primary hover:bg-accent transition-all",
//       )}
//     >
//       <div className="p-2 rounded-full bg-muted/50 text-muted-foreground">{icon}</div>
//       <span className="text-[10px] font-medium text-foreground/60">{label}</span>
//       <input
//         ref={inputRef}
//         type="file"
//         accept={accept}
//         className="hidden"
//         onChange={(e) => {
//           if (e.target.files?.[0]) onUpload(e.target.files[0]);
//         }}
//       />
//     </button>
//   );
// }

// /* ── storage upload + state helpers ── */

// function getMediaDuration(file: File): Promise<number> {
//   return new Promise((resolve) => {
//     const url = URL.createObjectURL(file);
//     const el = file.type.startsWith("video/")
//       ? document.createElement("video")
//       : document.createElement("audio");
//     el.preload = "metadata";
//     el.onloadedmetadata = () => {
//       const dur = isFinite(el.duration) ? el.duration : 0;
//       URL.revokeObjectURL(url);
//       resolve(dur);
//     };
//     el.onerror = () => {
//       URL.revokeObjectURL(url);
//       resolve(0);
//     };
//     el.src = url;
//   });
// }

// function uploadAndTrack(
//   key: "images" | "videos" | "audios",
//   files: File[],
//   setSlots: React.Dispatch<React.SetStateAction<MediaSlots>>,
// ) {
//   const placeholders: FileSlot[] = files.map((f) => ({
//     file: f,
//     preview: URL.createObjectURL(f),
//     uploading: true,
//     progress: 0,
//   }));

//   setSlots((prev) => ({ ...prev, [key]: [...prev[key], ...placeholders] }));

//   if (key === "videos" || key === "audios") {
//     files.forEach((file) => {
//       void getMediaDuration(file).then((dur) => {
//         setSlots((prev) => {
//           const idx = findSlotIndex(prev[key], file);
//           if (idx === -1) return prev;
//           return updateSlotAt(prev, key, idx, { duration: dur });
//         });
//       });
//     });
//   }

//   files.forEach((file, fileIdx) => {
//     const insertIdx = (setSlots as unknown as { _snap?: MediaSlots })?._snap
//       ? 0
//       : -1;
//     void (async () => {
//       setSlots((prev) => {
//         const baseIdx = prev[key].length - files.length + fileIdx;
//         return updateSlotAt(prev, key, baseIdx, { uploading: true, progress: 0 });
//       });

//       const result = await uploadFileToStorage(file, (p) => {
//         setSlots((prev) => {
//           const baseIdx = findSlotIndex(prev[key], file);
//           if (baseIdx === -1) return prev;
//           return updateSlotAt(prev, key, baseIdx, { progress: p.percentage });
//         });
//       });

//       setSlots((prev) => {
//         const idx = findSlotIndex(prev[key], file);
//         if (idx === -1) return prev;
//         if (result.success) {
//           return updateSlotAt(prev, key, idx, {
//             uploading: false,
//             progress: 100,
//             blobUrl: result.blobUrl,
//           });
//         }
//         return updateSlotAt(prev, key, idx, {
//           uploading: false,
//           error: result.error || "Upload failed",
//         });
//       });
//     })();
//   });
// }

// async function validateAndUpload(
//   key: "videos" | "audios",
//   newFiles: File[],
//   existingSlots: FileSlot[],
//   setSlots: React.Dispatch<React.SetStateAction<MediaSlots>>,
// ) {
//   const label = key === "videos" ? "video" : "audio";
//   const existingTotal = getTotalDuration(existingSlots);
//   const newDurations = await Promise.all(newFiles.map(getMediaDuration));

//   for (let i = 0; i < newFiles.length; i++) {
//     if (newDurations[i] > MAX_MEDIA_DURATION) {
//       toast.error(
//         `"${newFiles[i].name}" is ${parseFloat(newDurations[i].toFixed(1))}s — each ${label} must be ${MAX_MEDIA_DURATION}s or less.`,
//       );
//       return;
//     }
//   }

//   const newTotal = newDurations.reduce((sum, d) => sum + d, 0);

//   if (existingTotal + newTotal > MAX_MEDIA_DURATION) {
//     toast.error(
//       `Total ${label} length would be ${parseFloat((existingTotal + newTotal).toFixed(1))}s, exceeding the ${MAX_MEDIA_DURATION}s limit.`,
//     );
//     return;
//   }

//   uploadAndTrack(key, newFiles, setSlots);
// }

// function uploadSingleAndTrack(
//   type: "firstFrame" | "lastFrame",
//   file: File,
//   setSlots: React.Dispatch<React.SetStateAction<MediaSlots>>,
// ) {
//   const preview = URL.createObjectURL(file);
//   setSlots((prev) => {
//     if (prev[type]) URL.revokeObjectURL(prev[type]!.preview);
//     return { ...prev, [type]: { file, preview, uploading: true, progress: 0 } };
//   });

//   void (async () => {
//     const result = await uploadFileToStorage(file, (p) => {
//       setSlots((prev) => {
//         if (!prev[type]) return prev;
//         return { ...prev, [type]: { ...prev[type]!, progress: p.percentage } };
//       });
//     });

//     setSlots((prev) => {
//       if (!prev[type]) return prev;
//       if (result.success) {
//         return {
//           ...prev,
//           [type]: { ...prev[type]!, uploading: false, progress: 100, blobUrl: result.blobUrl },
//         };
//       }
//       return {
//         ...prev,
//         [type]: { ...prev[type]!, uploading: false, error: result.error || "Upload failed" },
//       };
//     });
//   })();
// }

// function findSlotIndex(arr: FileSlot[], file: File): number {
//   return arr.findIndex((s) => s.file === file);
// }

// function updateSlotAt(
//   prev: MediaSlots,
//   key: "images" | "videos" | "audios",
//   idx: number,
//   patch: Partial<FileSlot>,
// ): MediaSlots {
//   const arr = [...prev[key]];
//   arr[idx] = { ...arr[idx], ...patch };
//   return { ...prev, [key]: arr };
// }

// function removeFile(
//   key: "images" | "videos" | "audios",
//   index: number,
//   setSlots: React.Dispatch<React.SetStateAction<MediaSlots>>,
// ) {
//   setSlots((prev) => {
//     const item = prev[key][index];
//     if (item) URL.revokeObjectURL(item.preview);
//     return { ...prev, [key]: prev[key].filter((_, i) => i !== index) };
//   });
// }

// function clearSingleSlot(
//   type: "firstFrame" | "lastFrame",
//   setSlots: React.Dispatch<React.SetStateAction<MediaSlots>>,
// ) {
//   setSlots((prev) => {
//     if (prev[type]) URL.revokeObjectURL(prev[type]!.preview);
//     return { ...prev, [type]: null };
//   });
// }

// function getTotalDuration(slots: FileSlot[]): number {
//   return slots.reduce((sum, s) => sum + (s.duration ?? 0), 0);
// }

// function formatTotalDuration(slots: FileSlot[]): string {
//   const total = getTotalDuration(slots);
//   return `${parseFloat(total.toFixed(1))}s / ${MAX_MEDIA_DURATION}s`;
// }

// export function isMediaDurationExceeded(slots: MediaSlots): { videos: boolean; audios: boolean } {
//   return {
//     videos: getTotalDuration(slots.videos) > MAX_MEDIA_DURATION,
//     audios: getTotalDuration(slots.audios) > MAX_MEDIA_DURATION,
//   };
// }

// /* ── Main component ── */

// interface MediaUploadProps {
//   mode: string;
//   slots: MediaSlots;
//   setSlots: React.Dispatch<React.SetStateAction<MediaSlots>>;
// }

// export function MediaUpload({ mode, slots, setSlots }: MediaUploadProps) {
//   const isOmni = mode === "omni_reference";

//   if (!isOmni) {
//     return (
//       <div className="flex flex-col gap-3">
//         <div>
//           <h3 className="text-sm font-semibold text-foreground/80">First & Last Frame</h3>
//           <p className="text-xs text-muted-foreground mt-0.5">Upload the first and last frame images to guide video generation</p>
//         </div>
//         <div className="flex items-center flex-wrap gap-2 overflow-x-auto">
//           <CompactSlot
//             label="First Frame"
//             accept="image/*"
//             slot={slots.firstFrame}
//             onUpload={(f) => uploadSingleAndTrack("firstFrame", f, setSlots)}
//             onRemove={() => clearSingleSlot("firstFrame", setSlots)}
//             icon={<ImageIcon className="h-4 w-4" />}
//           />
//           <CompactSlot
//             label="Last Frame"
//             accept="image/*"
//             slot={slots.lastFrame}
//             onUpload={(f) => uploadSingleAndTrack("lastFrame", f, setSlots)}
//             onRemove={() => clearSingleSlot("lastFrame", setSlots)}
//             icon={<ImageIcon className="h-4 w-4" />}
//           />
//         </div>
//       </div>
//     );
//   }

//   const durationExceeded = isMediaDurationExceeded(slots);

//   const hasAnyMedia =
//     slots.images.length > 0 || slots.videos.length > 0 || slots.audios.length > 0;

//   return (
//     <div className="flex flex-col gap-3">
//       <div>
//         <h3 className="text-sm font-semibold text-foreground/80">Reference Media</h3>
//         <p className="text-xs text-muted-foreground mt-0.5">Upload images, videos, and music to guide your generation</p>
//       </div>

//       {/* Upload buttons row */}
//       <div className="flex items-center flex-wrap gap-2">
//         <UploadButton
//           label="Images"
//           accept="image/*"
//           icon={<ImageIcon className="h-5 w-5" />}
//           count={slots.images.length}
//           max={MAX_IMAGES}
//           multiple
//           onUpload={(files) => uploadAndTrack("images", files, setSlots)}
//         />
//         <UploadButton
//           label="Videos"
//           accept="video/*"
//           icon={<Video className="h-5 w-5" />}
//           count={slots.videos.length}
//           max={MAX_VIDEOS}
//           multiple
//           onUpload={(files) => validateAndUpload("videos", files, slots.videos, setSlots)}
//         />
//         <UploadButton
//           label="Music"
//           accept="audio/*"
//           icon={<Music className="h-5 w-5" />}
//           count={slots.audios.length}
//           max={MAX_AUDIOS}
//           multiple
//           onUpload={(files) => validateAndUpload("audios", files, slots.audios, setSlots)}
//         />
//       </div>

//       {/* Previews — separate columns per media type */}
//       {hasAnyMedia && (
//         <div className="grid grid-cols-3 gap-3">
//           {slots.images.length > 0 && (
//             <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-muted/30 p-2.5">
//               <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
//                 Images ({slots.images.length}/{MAX_IMAGES})
//               </span>
//               <div className="flex flex-wrap gap-1.5">
//                 {slots.images.map((img, i) => (
//                   <ImageThumb key={img.preview} slot={img} label={`@image_file_${i + 1}`} onRemove={() => removeFile("images", i, setSlots)} />
//                 ))}
//               </div>
//             </div>
//           )}

//           {slots.videos.length > 0 && (
//             <div className={cn(
//               "flex flex-col gap-2 rounded-xl border p-2.5",
//               durationExceeded.videos
//                 ? "border-red-500/50 bg-red-500/5"
//                 : "border-foreground/10 bg-muted/30",
//             )}>
//               <span className={cn(
//                 "text-[10px] font-semibold uppercase tracking-wider px-0.5",
//                 durationExceeded.videos ? "text-red-500" : "text-muted-foreground",
//               )}>
//                 Videos ({slots.videos.length}/{MAX_VIDEOS}) · {formatTotalDuration(slots.videos)}
//                 {durationExceeded.videos && " — exceeds limit"}
//               </span>
//               <div className="flex flex-wrap gap-1.5">
//                 {slots.videos.map((vid, i) => (
//                   <VideoThumb key={vid.preview} slot={vid} label={`@video_file_${i + 1}`} onRemove={() => removeFile("videos", i, setSlots)} />
//                 ))}
//               </div>
//             </div>
//           )}

//           {slots.audios.length > 0 && (
//             <div className={cn(
//               "flex flex-col gap-2 rounded-xl border p-2.5",
//               durationExceeded.audios
//                 ? "border-red-500/50 bg-red-500/5"
//                 : "border-foreground/10 bg-muted/30",
//             )}>
//               <span className={cn(
//                 "text-[10px] font-semibold uppercase tracking-wider px-0.5",
//                 durationExceeded.audios ? "text-red-500" : "text-muted-foreground",
//               )}>
//                 Music ({slots.audios.length}/{MAX_AUDIOS}) · {formatTotalDuration(slots.audios)}
//                 {durationExceeded.audios && " — exceeds limit"}
//               </span>
//               <div className="flex flex-wrap gap-1.5">
//                 {slots.audios.map((aud, i) => (
//                   <AudioThumb key={aud.preview} slot={aud} label={`@audio_file_${i + 1}`} onRemove={() => removeFile("audios", i, setSlots)} />
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
