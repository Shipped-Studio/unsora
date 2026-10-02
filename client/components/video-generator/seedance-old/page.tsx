// "use client";

// import { useState, useCallback, useRef, useEffect } from "react";
// import {
//   MediaUpload,
//   type MediaSlots,
//   type FileSlot,
//   isMediaDurationExceeded,
// } from "@/components/seedance/media-upload";
// import {
//   PromptBar,
//   type PromptFileItem,
// } from "@/components/seedance/prompt-bar";
// import { GenerationStatusList } from "@/components/seedance/generation-status";
// import {
//   RecentGenerations,
//   type Generation,
// } from "@/components/seedance/recent-generations";
// import {
//   VideoDetailViewer,
//   type ViewerGeneration,
// } from "@/components/seedance/video-detail-viewer";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import {
//   Sheet,
//   SheetContent,
//   SheetHeader,
//   SheetTitle,
//   SheetDescription,
// } from "@/components/ui/sheet";
// import { VideoUpscaleModal } from "@/components/seedance/video-upscale-modal";
// import { Button } from "@/components/ui/button";
// import { SeedancePromptGuide } from "@/components/seedance-prompt-guide";
// import { useGeneration } from "@/hooks/use-generation";
// import type { ActiveGeneration } from "@/hooks/use-generation";
// import { toast } from "sonner";
// import {
//   AlertTriangle,
//   ShieldAlert,
//   BookOpen,
//   Sparkles,
//   ArrowUpCircle,
//   CheckCircle2,
// } from "lucide-react";
// import { useSignUp, useUser } from "@clerk/nextjs";
// import { useRouter } from "next/navigation";
// import { SUGGESTED_PROMPTS } from "@/constant";
// import Link from "next/link";

// const GUIDELINES_STORAGE_KEY = "seedance-guidelines-seen";
// const DISRUPTION_STORAGE_KEY = "seedance-disruption-seen";
// const RESTORED_STORAGE_KEY = "seedance-restored-seen";

// export default function SeedancePage() {
//   const [showGuidelines, setShowGuidelines] = useState(false);
//   const [showDisruption, setShowDisruption] = useState(false);
//   const [showRestored, setShowRestored] = useState(false);
//   const [showPromptGuide, setShowPromptGuide] = useState(false);
//   const [showUpscaleModal, setShowUpscaleModal] = useState(false);
//   const { user } = useUser();

//   useEffect(() => {
//     if (!localStorage.getItem(GUIDELINES_STORAGE_KEY)) {
//       setShowGuidelines(true);
//     }

//     // if (!localStorage.getItem(DISRUPTION_STORAGE_KEY)) {
//     //   setShowDisruption(true);
//     // }

//     if (!localStorage.getItem(RESTORED_STORAGE_KEY)) {
//       setShowRestored(true);
//     }
//   }, []);

//   const dismissGuidelines = useCallback(() => {
//     setShowGuidelines(false);
//     localStorage.setItem(GUIDELINES_STORAGE_KEY, "1");
//   }, []);

//   const [slots, setSlots] = useState<MediaSlots>({
//     images: [],
//     videos: [],
//     audios: [],
//     firstFrame: null,
//     lastFrame: null,
//   });
//   const [prompt, setPrompt] = useState("");
//   const [model, setModel] = useState("seedance_2.0");
//   const [mode, setMode] = useState("omni_reference");
//   const [ratio, setRatio] = useState("16:9");
//   const [duration, setDuration] = useState("15");
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [refreshKey, setRefreshKey] = useState(0);
//   const router = useRouter();
//   const { signUp } = useSignUp();
//   const { activeGenerations, submitGeneration, dismissGeneration } =
//     useGeneration();

//   // Viewer state
//   const [viewerGen, setViewerGen] = useState<ViewerGeneration | null>(null);
//   const viewerListRef = useRef<ViewerGeneration[]>([]);

//   const openViewer = useCallback(
//     (gen: ViewerGeneration, list: ViewerGeneration[]) => {
//       viewerListRef.current = list;
//       setViewerGen(gen);
//     },
//     [],
//   );

//   const handleRecentSelect = useCallback(
//     (gen: Generation, all: Generation[]) => {
//       openViewer(gen as ViewerGeneration, all as ViewerGeneration[]);
//     },
//     [openViewer],
//   );

//   const handleActiveSelect = useCallback(
//     (gen: ViewerGeneration) => {
//       const list = activeGenerations
//         .filter((g) => g.status === "COMPLETED")
//         .map((g) => ({
//           ...g,
//           model: "",
//           functionMode: "",
//           outputUrl: g.outputUrl ?? null,
//           thumbnailUrl: g.thumbnailUrl ?? null,
//         })) as ViewerGeneration[];
//       openViewer(gen, list);
//     },
//     [activeGenerations, openViewer],
//   );

//   const handleRemoved = useCallback((id: string) => {
//     viewerListRef.current = viewerListRef.current.filter((g) => g.id !== id);
//     setRefreshKey((k) => k + 1);
//   }, []);

//   const closeViewer = useCallback(() => setViewerGen(null), []);

//   const navigateViewer = useCallback(
//     (dir: -1 | 1) => {
//       if (!viewerGen) return;
//       const list = viewerListRef.current;
//       const idx = list.findIndex((g) => g.id === viewerGen.id);
//       const next = list[idx + dir];
//       if (next) setViewerGen(next);
//     },
//     [viewerGen],
//   );

//   const viewerIdx = viewerGen
//     ? viewerListRef.current.findIndex((g) => g.id === viewerGen.id)
//     : -1;

//   const fillPrompt = useCallback((text: string) => {
//     setPrompt(text);
//     const editor = document.getElementById("seedance-prompt-editor");
//     if (editor) {
//       editor.innerText = text;
//       editor.focus();
//     }
//   }, []);

//   const fileSlotFromUrl = useCallback(
//     (url: string, type: "image" | "video" | "audio"): FileSlot => {
//       const ext = type === "image" ? "jpg" : type === "video" ? "mp4" : "mp3";
//       const mime =
//         type === "image"
//           ? "image/jpeg"
//           : type === "video"
//             ? "video/mp4"
//             : "audio/mpeg";
//       return {
//         file: new File([], `reference.${ext}`, { type: mime }),
//         preview: url,
//         blobUrl: url,
//         uploading: false,
//         progress: 100,
//       };
//     },
//     [],
//   );

//   const handleActiveReuse = useCallback(
//     (gen: ActiveGeneration) => {
//       fillPrompt(gen.prompt);

//       if (gen.model) setModel(gen.model);
//       if (gen.ratio) setRatio(gen.ratio);
//       if (gen.duration) setDuration(String(gen.duration));

//       const modeVal =
//         gen.functionMode === "OMNI_REFERENCE" ||
//         gen.functionMode === "omni_reference"
//           ? "omni_reference"
//           : gen.functionMode === "first_last_frames" ||
//               gen.functionMode === "FIRST_LAST_FRAMES"
//             ? "first_last_frames"
//             : "omni_reference";
//       setMode(modeVal);

//       if (modeVal === "omni_reference") {
//         setSlots({
//           images: (gen.imageFiles || []).map((u) =>
//             fileSlotFromUrl(u, "image"),
//           ),
//           videos: (gen.videoFiles || []).map((u) =>
//             fileSlotFromUrl(u, "video"),
//           ),
//           audios: (gen.audioFiles || []).map((u) =>
//             fileSlotFromUrl(u, "audio"),
//           ),
//           firstFrame: null,
//           lastFrame: null,
//         });
//       } else {
//         const paths = gen.filePaths || [];
//         setSlots({
//           images: [],
//           videos: [],
//           audios: [],
//           firstFrame: paths[0] ? fileSlotFromUrl(paths[0], "image") : null,
//           lastFrame: paths[1] ? fileSlotFromUrl(paths[1], "image") : null,
//         });
//       }

//       toast.success("Prompt & assets copied to editor");
//     },
//     [fillPrompt, fileSlotFromUrl],
//   );

//   const handleCopyPrompt = useCallback(
//     (gen: ViewerGeneration) => {
//       fillPrompt(gen.prompt);

//       const modeVal =
//         gen.functionMode === "OMNI_REFERENCE" ||
//         gen.functionMode === "omni_reference"
//           ? "omni_reference"
//           : "first_last_frames";
//       setMode(modeVal);

//       if (modeVal === "omni_reference") {
//         setSlots({
//           images: (gen.imageFiles || []).map((u) =>
//             fileSlotFromUrl(u, "image"),
//           ),
//           videos: (gen.videoFiles || []).map((u) =>
//             fileSlotFromUrl(u, "video"),
//           ),
//           audios: (gen.audioFiles || []).map((u) =>
//             fileSlotFromUrl(u, "audio"),
//           ),
//           firstFrame: null,
//           lastFrame: null,
//         });
//       } else {
//         const paths = gen.filePaths || [];
//         setSlots({
//           images: [],
//           videos: [],
//           audios: [],
//           firstFrame: paths[0] ? fileSlotFromUrl(paths[0], "image") : null,
//           lastFrame: paths[1] ? fileSlotFromUrl(paths[1], "image") : null,
//         });
//       }

//       setViewerGen(null);
//       toast.success("Prompt & assets copied to editor");
//     },
//     [fillPrompt, fileSlotFromUrl],
//   );

//   const handleRetry = useCallback(
//     (gen: ViewerGeneration) => {
//       fillPrompt(gen.prompt);
//       setModel(gen.model || "seedance_2.0");

//       const modeVal =
//         gen.functionMode === "OMNI_REFERENCE" ||
//         gen.functionMode === "omni_reference"
//           ? "omni_reference"
//           : "first_last_frames";
//       setMode(modeVal);
//       setRatio(gen.ratio || "16:9");
//       setDuration(String(gen.duration || 15));

//       if (modeVal === "omni_reference") {
//         setSlots({
//           images: (gen.imageFiles || []).map((u) =>
//             fileSlotFromUrl(u, "image"),
//           ),
//           videos: (gen.videoFiles || []).map((u) =>
//             fileSlotFromUrl(u, "video"),
//           ),
//           audios: (gen.audioFiles || []).map((u) =>
//             fileSlotFromUrl(u, "audio"),
//           ),
//           firstFrame: null,
//           lastFrame: null,
//         });
//       } else {
//         const paths = gen.filePaths || [];
//         setSlots({
//           images: [],
//           videos: [],
//           audios: [],
//           firstFrame: paths[0] ? fileSlotFromUrl(paths[0], "image") : null,
//           lastFrame: paths[1] ? fileSlotFromUrl(paths[1], "image") : null,
//         });
//       }

//       setViewerGen(null);
//       toast.success("Ready to retry — click Generate when ready");
//     },
//     [fillPrompt, fileSlotFromUrl],
//   );

//   const mentionableFiles: PromptFileItem[] =
//     mode === "omni_reference"
//       ? [
//           ...slots.images.map((img: FileSlot) => ({
//             ...img,
//             type: "image" as const,
//           })),
//           ...slots.videos.map((vid: FileSlot) => ({
//             ...vid,
//             type: "video" as const,
//             duration: vid.duration,
//           })),
//           ...slots.audios.map((aud: FileSlot) => ({
//             ...aud,
//             type: "audio" as const,
//             duration: aud.duration,
//           })),
//         ]
//       : [
//           ...(slots.firstFrame
//             ? [{ ...slots.firstFrame, type: "image" as const }]
//             : []),
//           ...(slots.lastFrame
//             ? [{ ...slots.lastFrame, type: "image" as const }]
//             : []),
//         ];

//   const handleGenerate = useCallback(async () => {
//     const trimmed = prompt.trim();
//     if (!trimmed) {
//       toast.error("Please enter a prompt");
//       return;
//     }

//     const anyUploading =
//       slots.images.some((s) => s.uploading) ||
//       slots.videos.some((s) => s.uploading) ||
//       slots.audios.some((s) => s.uploading) ||
//       slots.firstFrame?.uploading ||
//       slots.lastFrame?.uploading;

//     if (anyUploading) {
//       toast.error("Please wait for media uploads to finish");
//       return;
//     }

//     const exceeded = isMediaDurationExceeded(slots);
//     if (exceeded.videos) {
//       toast.error(
//         "Total video length exceeds 15 seconds. Please remove some videos.",
//       );
//       return;
//     }
//     if (exceeded.audios) {
//       toast.error(
//         "Total audio length exceeds 15 seconds. Please remove some audio files.",
//       );
//       return;
//     }

//     setIsSubmitting(true);

//     const params: Parameters<typeof submitGeneration>[0] = {
//       prompt: trimmed,
//       model,
//       functionMode: mode,
//       ratio,
//       duration: Number(duration),
//     };

//     if (mode === "omni_reference") {
//       const imageUrls = slots.images
//         .filter((s) => s.blobUrl)
//         .map((s) => s.blobUrl!);
//       const videoUrls = slots.videos
//         .filter((s) => s.blobUrl)
//         .map((s) => s.blobUrl!);
//       const audioUrls = slots.audios
//         .filter((s) => s.blobUrl)
//         .map((s) => s.blobUrl!);
//       if (imageUrls.length) params.image_files = imageUrls;
//       if (videoUrls.length) params.video_files = videoUrls;
//       if (audioUrls.length) params.audio_files = audioUrls;
//     } else {
//       const filePaths: string[] = [];
//       if (slots.firstFrame?.blobUrl) filePaths.push(slots.firstFrame.blobUrl);
//       if (slots.lastFrame?.blobUrl) filePaths.push(slots.lastFrame.blobUrl);
//       if (filePaths.length) params.filePaths = filePaths;
//     }

//     const result = await submitGeneration(params);
//     setIsSubmitting(false);

//     if (result) {
//       setPrompt("");
//       setSlots({
//         images: [],
//         videos: [],
//         audios: [],
//         firstFrame: null,
//         lastFrame: null,
//       });
//       const editor = document.getElementById("seedance-prompt-editor");
//       if (editor) editor.innerHTML = "";
//     }
//   }, [prompt, model, mode, ratio, duration, slots, submitGeneration]);

//   return (
//     <>
//       <div className="flex flex-col items-center min-h-[800px] w-full max-w-5xl mx-auto px-3 sm:px-4 pt-16 sm:pt-24 gap-4 sm:gap-6">
//         <div className="text-center">
//           <h1 className="text-xl font-semibold">Generate AI Videos</h1>
//         </div>

//         {/* Service disruption notice */}
//         <div className="w-full max-w-[800px]">
//           <div className="rounded-xl border border-amber-500/20 bg-neutral-900 px-4 py-4 sm:px-5 sm:py-5 text-white space-y-3 sm:space-y-4">
//             <div className="flex items-start gap-3 sm:gap-4">
//               <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
//                 <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
//               </div>
//               <div className="flex flex-col gap-1">
//                 <h3 className="text-sm sm:text-base font-bold tracking-tight">
//                   Delay in Generation Expected
//                 </h3>
//                 <p className="text-xs sm:text-sm leading-relaxed text-white/70">
//                   Video generation is powered by the Seedance 2.0 model, where
//                   we send all video requests.
//                 </p>
//               </div>
//             </div>

//             <div className="border-t border-white/10 pt-3 sm:pt-4 flex flex-col gap-0.5">
//               <p className="text-sm sm:text-base text-primary font-bold tracking-tight">
//                 High demand during China daytime hours may increase wait times
//                 up to 1–2 hours due to upstream traffic.
//               </p>
//             </div>

//             <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:p-4">
//               <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
//                 Important
//               </p>

//               <ul className="mt-2 space-y-2 text-sm sm:text-base leading-relaxed">
//                 <li className="flex items-start gap-2 text-white/90">
//                   <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
//                   <span>
//                     Delays are outside our control. Generation is usually faster
//                     (<span className="font-semibold text-white">8–15 min</span>)
//                     during US daytime hours. Thanks for your patience.
//                   </span>
//                 </li>
//                 <li className="flex items-start gap-2 text-white/90">
//                   <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
//                   <span>
//                     Please review required credits before clicking{" "}
//                     <span className="font-semibold text-white">Generate</span>.
//                     Credit costs may change based on upstream provider pricing.
//                   </span>
//                 </li>
//               </ul>
//             </div>

//             <div className="flex items-center justify-end gap-2">
//               <button
//                 onClick={() => setShowPromptGuide(true)}
//                 data-umami-event="prompt-guide-button"
//                 className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
//               >
//                 <BookOpen className="h-3.5 w-3.5" />
//                 Prompt Guide
//               </button>
//               <button
//                 data-umami-event="guidelines-button"
//                 onClick={() => setShowGuidelines(true)}
//                 className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
//               >
//                 <ShieldAlert className="h-3.5 w-3.5" />
//                 Guidelines
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Media upload slots */}
//         <div className="w-full max-w-[800px] space-y-4 sm:space-y-6">
//           <MediaUpload mode={mode} slots={slots} setSlots={setSlots} />

//           {/* Prompt bar */}
//           <div className="w-full">
//             <PromptBar
//               files={mentionableFiles}
//               prompt={prompt}
//               setPrompt={setPrompt}
//               model={model}
//               setModel={setModel}
//               mode={mode}
//               setMode={setMode}
//               ratio={ratio}
//               setRatio={setRatio}
//               duration={duration}
//               setDuration={setDuration}
//               onGenerate={handleGenerate}
//               isGenerating={isSubmitting}
//             />
//           </div>

//           {/* Upscale button */}
//           <Button
//             variant="outline"
//             size="lg"
//             className="w-full"
//             onClick={() => setShowUpscaleModal(true)}
//           >
//             <ArrowUpCircle className="h-5 w-5" />
//             Upscale Your Videos to HD / 4K
//           </Button>

//           {/* Suggested prompts */}
//           {!prompt.trim() && (
//             <div className="space-y-2">
//               <p className="text-xs text-muted-foreground">
//                 Try these Magic Prompts 🔥🔥:
//               </p>
//               <div className="flex flex-wrap gap-2">
//                 {SUGGESTED_PROMPTS.map((sp) => (
//                   <button
//                     key={sp.label}
//                     onClick={() => fillPrompt(sp.text)}
//                     className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
//                   >
//                     <Sparkles className="h-3 w-3" />
//                     {sp.label}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* In-progress generations */}
//         {activeGenerations.length > 0 && (
//           <div className="w-full">
//             <GenerationStatusList
//               generations={activeGenerations}
//               onDismiss={dismissGeneration}
//               onSelect={(gen) =>
//                 handleActiveSelect({
//                   ...gen,
//                   model: "",
//                   functionMode: "",
//                   outputUrl: gen.outputUrl ?? null,
//                   thumbnailUrl: gen.thumbnailUrl ?? null,
//                 })
//               }
//               onReuse={handleActiveReuse}
//             />
//           </div>
//         )}

//         {/* Recent generations */}
//         <div className="w-full mt-4">
//           <RecentGenerations
//             onSelect={handleRecentSelect}
//             onCopyPrompt={(gen) => handleCopyPrompt(gen as ViewerGeneration)}
//             onRetry={(gen) => handleRetry(gen as ViewerGeneration)}
//             refreshKey={refreshKey}
//           />
//         </div>
//       </div>

//       {/* Video detail viewer */}
//       {viewerGen && (
//         <VideoDetailViewer
//           generation={viewerGen}
//           onClose={closeViewer}
//           onPrev={() => navigateViewer(-1)}
//           onNext={() => navigateViewer(1)}
//           hasPrev={viewerIdx > 0}
//           hasNext={viewerIdx < viewerListRef.current.length - 1}
//           onRemoved={handleRemoved}
//           onCopyPrompt={handleCopyPrompt}
//           onRetry={handleRetry}
//         />
//       )}

//       {/* Prompt Guide Sheet */}
//       <Sheet open={showPromptGuide} onOpenChange={setShowPromptGuide}>
//         <SheetContent
//           side="right"
//           className="w-full sm:max-w-lg overflow-y-auto"
//         >
//           <SheetHeader>
//             <SheetTitle className="flex items-center gap-2">
//               <BookOpen className="h-5 w-5 text-primary" />
//               Seedance 2.0 Prompt Guide
//             </SheetTitle>
//             <SheetDescription>
//               How to write prompts that pass on the first try
//             </SheetDescription>
//           </SheetHeader>
//           <div className="px-4 pb-8">
//             <SeedancePromptGuide />
//           </div>
//         </SheetContent>
//       </Sheet>

//       {/* Video upscale modal */}
//       <VideoUpscaleModal
//         open={showUpscaleModal}
//         onOpenChange={setShowUpscaleModal}
//       />

//       {/* Service disruption dialog */}
//       <Dialog
//         open={showDisruption}
//         onOpenChange={(open) => {
//           if (!open) {
//             setShowDisruption(false);
//             localStorage.setItem(DISRUPTION_STORAGE_KEY, "1");
//           }
//         }}
//       >
//         <DialogContent className="max-w-md">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2 text-red-400">
//               Seedance 2.0 is temporarily unavailable
//             </DialogTitle>
//             <DialogDescription>
//               We&apos;re currently experiencing an unexpected service disruption
//               affecting access to Seedance 2.0 and are working to restore it as
//               quickly as possible.
//             </DialogDescription>
//           </DialogHeader>

//           <div className="text-sm text-muted-foreground leading-relaxed">
//             <p>
//               Thank you for your patience and understanding. In the meantime,
//               for urgent needs, please use{" "}
//               <Link
//                 href="/kling"
//                 className="font-semibold underline underline-offset-2 hover:text-primary/80 transition-colors"
//               >
//                 Kling 3.0
//               </Link>{" "}
//               on UnSora. For support or assistance, reach out to us on{" "}
//               <Link
//                 href="https://t.me/unsora_ai"
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="font-semibold underline underline-offset-2 hover:text-primary/80 transition-colors"
//               >
//                 Telegram
//               </Link>
//               .
//             </p>
//           </div>

//           <DialogFooter>
//             <button
//               onClick={() => {
//                 setShowDisruption(false);
//                 localStorage.setItem(DISRUPTION_STORAGE_KEY, "1");
//               }}
//               className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
//             >
//               I understand
//             </button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* Service restored dialog */}
//       <Dialog
//         open={showRestored}
//         onOpenChange={(open) => {
//           if (!open) {
//             setShowRestored(false);
//             localStorage.setItem(RESTORED_STORAGE_KEY, "1");
//           }
//         }}
//       >
//         <DialogContent className="max-w-md">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2">
//               <CheckCircle2 className="h-5 w-5 text-green-500" />
//               Seedance 2.0 is back
//             </DialogTitle>
//             <DialogDescription>
//               Service has been restored and Seedance 2.0 is now available again.
//               Thank you for your patience.
//             </DialogDescription>
//           </DialogHeader>

//           <div className="text-sm text-muted-foreground leading-relaxed">
//             <p>
//               If you encounter an &ldquo;unknown error&rdquo;, it typically
//               means a content violation was detected. Please review the
//               guidelines to ensure your prompt and media comply.
//             </p>
//           </div>

//           <DialogFooter>
//             <button
//               onClick={() => {
//                 setShowRestored(false);
//                 localStorage.setItem(RESTORED_STORAGE_KEY, "1");
//               }}
//               className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
//             >
//               Got it
//             </button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* Guidelines modal */}
//       <Dialog
//         open={showGuidelines}
//         onOpenChange={(open) => {
//           if (!open) dismissGuidelines();
//         }}
//       >
//         <DialogContent className="max-w-md">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2">
//               <ShieldAlert className="h-5 w-5 text-amber-500" />
//               How to Avoid Getting an Error
//             </DialogTitle>
//             <DialogDescription>
//               To ensure the system runs smoothly, please follow these
//               guidelines:
//             </DialogDescription>
//           </DialogHeader>

//           <div className="space-y-4 text-sm">
//             <div>
//               <p className="font-medium">
//                 1. Do not mention IP-protected terms in your prompt
//               </p>
//               <p className="text-muted-foreground mt-1">
//                 Avoid using phrases like &ldquo;in Star Wars style&rdquo; or
//                 referencing real individuals such as &ldquo;Tom Cruise
//                 fighting&rdquo;.
//               </p>
//             </div>

//             <div>
//               <p className="font-medium">
//                 2. Do not upload any IP-protected images or videos
//               </p>
//               <p className="text-muted-foreground mt-1">This includes:</p>
//               <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5 ml-2">
//                 <li>Anime characters (e.g., Naruto)</li>
//                 <li>Actors or actresses</li>
//                 <li>Movie, game, or cartoon characters</li>
//                 <li>Any copyrighted or trademarked content</li>
//               </ul>
//             </div>

//             <div>
//               <p className="font-medium">
//                 3. Do not upload videos longer than 15 seconds
//               </p>
//               <p className="text-muted-foreground mt-1">
//                 The total combined video duration must not exceed 15 seconds.
//               </p>
//             </div>

//             <div>
//               <p className="font-medium">
//                 4. Do not upload audio files longer than 15 seconds
//               </p>
//               <p className="text-muted-foreground mt-1">
//                 The total combined audio duration must not exceed 15 seconds.
//               </p>
//             </div>
//           </div>

//           <DialogFooter>
//             <button
//               onClick={() => {
//                 if (user?.unsafeMetadata?.plan !== "free") {
//                   dismissGuidelines();
//                 } else {
//                   dismissGuidelines();
//                   router.push("/billing");
//                 }
//               }}
//               className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
//             >
//               I understand.{" "}
//               {user?.unsafeMetadata?.plan !== "free"
//                 ? ""
//                 : "Lets start Free Trial"}
//             </button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </>
//   );
// }
