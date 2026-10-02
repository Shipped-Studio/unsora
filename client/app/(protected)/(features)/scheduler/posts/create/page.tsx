"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CaretDown as ChevronDown,
  UploadSimple as Upload,
  Info,
  PaperPlaneTilt as Send,
  FloppyDisk as Save,
  X,
  FileVideo,
  ImageSquare as ImagePlus,
  Images as ImagesIcon,
  CaretLeft,
  CaretRight,
  Warning as AlertTriangle,
  CalendarBlank as Calendar,
  Clock,
  DownloadSimple as Download,
  ArrowsClockwise as Replace,
} from "@phosphor-icons/react";
import { useState, useRef, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import { formatFileSize, formatDuration } from "@/lib/video-utils";
import { AccountSelector } from "@/components/scheduler/account-selector";
import { AccountCaptions } from "@/components/scheduler/account-captions";
import { ImportVideoDialog } from "@/components/scheduler/import-video-dialog";
import { SlideshowPreview } from "@/components/scheduler/slideshow-preview";
import { CoverImageDialog } from "@/components/scheduler/cover-image-dialog";
import { TimezoneSelect } from "@/components/scheduler/timezone-select";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  usePostForm,
  INSTAGRAM_MAX_IMAGES,
  MAX_SLIDESHOW_IMAGES,
  YOUTUBE_MAX_DESCRIPTION_LENGTH,
  isInstagramRatioInvalid,
  type YouTubePrivacy,
} from "@/hooks/use-post-form";
import { fromZonedTime, getBrowserTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle } from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";

type SubmissionAction = "publish" | "draft" | "schedule";

const ACTION_COPY: Record<
  SubmissionAction,
  { active: string; success: string; activeMessage: string; successMessage: string }
> = {
  publish: {
    active: "Publishing your post",
    activeMessage: "Sending it off to your accounts…",
    success: "Post queued!",
    successMessage: "Your post is in the queue. Redirecting…",
  },
  schedule: {
    active: "Scheduling your post",
    activeMessage: "Locking in your publish time…",
    success: "Post scheduled!",
    successMessage: "We'll publish it for you. Redirecting…",
  },
  draft: {
    active: "Saving your draft",
    activeMessage: "Tucking your post away safely…",
    success: "Draft saved!",
    successMessage: "Come back anytime to finish it. Redirecting…",
  },
};

function getDefaultScheduleTime(): Date {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil((minutes + 10) / 5) * 5;
  now.setMinutes(roundedMinutes);
  now.setSeconds(0);
  now.setMilliseconds(0);
  if (roundedMinutes >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(roundedMinutes - 60);
  }
  return now;
}

export default function CreatePostPage() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionAction, setSubmissionAction] =
    useState<SubmissionAction>("publish");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(() =>
    getBrowserTimezone(),
  );

  const { authFetch } = useAuthFetch();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxCaptionLength = 2200;

  const {
    caption,
    setCaption,
    scheduleEnabled,
    setScheduleEnabled,
    coverImage,
    setCoverImage,
    videoAspectRatio,
    videoUrl,
    videoDuration,
    selectedAccounts,
    setSelectedAccounts,
    accountCaptions,
    captionsOpen,
    setCaptionsOpen,
    isPublishing,
    setIsPublishing,
    scheduledDate,
    setScheduledDate,
    youtubeTitle,
    setYoutubeTitle,
    youtubeDescription,
    setYoutubeDescription,
    youtubePrivacy,
    setYoutubePrivacy,
    youtubeMadeForKids,
    setYoutubeMadeForKids,
    validationErrors,
    selectedAccountsDetails,
    currentVideo,
    uploadedFile,
    importedVideo,
    uploadProgress,
    isUploading,
    mediaKind,
    images,
    imagesUploading,
    handleFileUpload,
    handleImportVideo,
    handleRemoveVideo,
    handleAccountCaptionChange,
    handleMediaKindChange,
    handleAddImages,
    handleRemoveImage,
    handleMoveImage,
    handleReorderImage,
    preparePostData,
  } = usePostForm();

  // Drag-to-reorder state for the photo grid tiles.
  const [dragImageId, setDragImageId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const tiktokAccounts = selectedAccountsDetails.filter(
    (acc) => acc.provider.toLowerCase() === "tiktok",
  );

  const hasInstagram = selectedAccountsDetails.some(
    (acc) => acc.provider.toLowerCase() === "instagram",
  );

  const readyImageCount = images.filter(
    (img) => img.uploadedUrl && !img.error,
  ).length;

  // Instagram carousels are capped at 10 images; block submit if exceeded.
  const instagramOverImageLimit =
    mediaKind === "photo" &&
    hasInstagram &&
    images.length > INSTAGRAM_MAX_IMAGES;

  // Instagram rejects images outside the 4:5–1.91:1 aspect-ratio range.
  const instagramBadRatioSlides =
    mediaKind === "photo" && hasInstagram
      ? images
          .map((img, index) => ({ img, index }))
          .filter(({ img }) => isInstagramRatioInvalid(img))
          .map(({ index }) => index + 1)
      : [];

  const hasMedia =
    mediaKind === "video" ? !!currentVideo : readyImageCount > 0;

  const handleScheduleToggle = (enabled: boolean) => {
    setScheduleEnabled(enabled);
    if (enabled && !scheduledDate) {
      setScheduledDate(getDefaultScheduleTime());
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      if (scheduledDate) {
        date.setHours(scheduledDate.getHours());
        date.setMinutes(scheduledDate.getMinutes());
      } else {
        const defaultTime = getDefaultScheduleTime();
        date.setHours(defaultTime.getHours());
        date.setMinutes(defaultTime.getMinutes());
      }
      date.setSeconds(0);
      date.setMilliseconds(0);
      setScheduledDate(date);
    }
  };

  const handleHourChange = (hour: string | null) => {
    if (!hour) return;
    const newDate = scheduledDate ? new Date(scheduledDate) : new Date();
    newDate.setHours(parseInt(hour));
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    setScheduledDate(newDate);
  };

  const handleMinuteChange = (minute: string | null) => {
    if (!minute) return;
    const newDate = scheduledDate ? new Date(scheduledDate) : new Date();
    newDate.setMinutes(parseInt(minute));
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    setScheduledDate(newDate);
  };

  const isPastTime = scheduledDate
    ? fromZonedTime(scheduledDate, scheduleTimezone).getTime() < Date.now()
    : false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const canSubmit =
    selectedAccounts.length > 0 &&
    !isPublishing &&
    !isUploading &&
    !imagesUploading &&
    hasMedia &&
    !instagramOverImageLimit &&
    instagramBadRatioSlides.length === 0;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("video/")) {
        const syntheticEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileUpload(syntheticEvent);
      } else {
        toast.error("Please drop a video file (MP4, MOV)");
      }
    },
    [handleFileUpload],
  );

  const handlePostNow = async () => {
    if (!caption.trim()) {
      toast.error("Please enter a caption");
      return;
    }
    if (selectedAccounts.length === 0) {
      toast.error("Please select at least one account");
      return;
    }
    if (hasValidationErrors) {
      toast.error("Please fix validation errors before publishing");
      return;
    }

    setSubmissionAction("publish");
    setSubmissionSuccess(false);
    setIsSubmitting(true);
    setIsPublishing(true);

    try {
      const postData = await preparePostData();
      const response = await authFetch("/api/posts/publish-now", {
        method: "POST",
        body: JSON.stringify(postData),
      });
      const data = await response.json();

      if (data.success) {
        setSubmissionSuccess(true);
        toast.success("Post queued for publishing!", {
          description:
            "Your post is in the queue and will appear on your profiles shortly.",
          duration: 5000,
        });
        setTimeout(() => router.push("/scheduler/posts"), 1500);
      } else {
        setIsSubmitting(false);
        toast.error(data.error || "Failed to queue post");
      }
    } catch (error) {
      console.error("Error publishing post:", error);
      setIsSubmitting(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to publish post",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!caption.trim()) {
      toast.error("Please enter a caption");
      return;
    }
    if (selectedAccounts.length === 0) {
      toast.error("Please select at least one account");
      return;
    }

    setSubmissionAction("draft");
    setSubmissionSuccess(false);
    setIsSubmitting(true);
    setIsPublishing(true);

    try {
      const postData = await preparePostData();
      const response = await authFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify(postData),
      });
      const data = await response.json();

      if (data.success) {
        setSubmissionSuccess(true);
        toast.success("Post saved as draft!");
        setTimeout(() => router.push("/scheduler/posts/draft"), 1500);
      } else {
        setIsSubmitting(false);
        toast.error(data.error || "Failed to save draft");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      setIsSubmitting(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to save draft",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!caption.trim()) {
      toast.error("Please enter a caption");
      return;
    }
    if (selectedAccounts.length === 0) {
      toast.error("Please select at least one account");
      return;
    }
    if (!scheduledDate) {
      toast.error("Please select a date and time");
      return;
    }
    if (hasValidationErrors) {
      toast.error("Please fix validation errors before scheduling");
      return;
    }

    setSubmissionAction("schedule");
    setSubmissionSuccess(false);
    setIsSubmitting(true);
    setIsPublishing(true);

    try {
      const postData = await preparePostData();
      const finalPostData = {
        ...postData,
        scheduledFor: fromZonedTime(scheduledDate, scheduleTimezone),
        timezone: scheduleTimezone,
      };

      const response = await authFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify(finalPostData),
      });
      const data = await response.json();

      if (data.success) {
        setSubmissionSuccess(true);
        toast.success("Post scheduled successfully!");
        setTimeout(() => router.push("/scheduler/posts/scheduled"), 1500);
      } else {
        setIsSubmitting(false);
        toast.error(data.error || "Failed to schedule post");
      }
    } catch (error) {
      console.error("Error scheduling post:", error);
      setIsSubmitting(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule post",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const submissionCopy = ACTION_COPY[submissionAction];

  const videoFileName = uploadedFile
    ? uploadedFile.name
    : importedVideo?.originalName;

  const videoFileInfo = uploadedFile
    ? formatFileSize(uploadedFile.size)
    : importedVideo?.durationSeconds
      ? formatDuration(importedVideo.durationSeconds)
      : null;

  return (
    <div>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Create Post
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a video and share it across your social accounts
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* ─── Main Form ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Accounts */}
            <AccountSelector
              selectedAccounts={selectedAccounts}
              onAccountsChange={setSelectedAccounts}
            />

            {/* Validation Alerts */}
            {validationErrors.duration && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Duration Issues</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-1 space-y-0.5">
                    {validationErrors.duration.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationErrors.youtubeTitle && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>YouTube Requirements</AlertTitle>
                <AlertDescription className="text-sm mt-1">
                  {validationErrors.youtubeTitle}
                </AlertDescription>
              </Alert>
            )}

            {/* Media type selector */}
            <div className="inline-flex rounded-lg border bg-muted p-1">
              <button
                type="button"
                onClick={() => handleMediaKindChange("video")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  mediaKind === "video"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileVideo className="h-4 w-4" />
                Video
              </button>
              <button
                type="button"
                onClick={() => handleMediaKindChange("photo")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  mediaKind === "photo"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ImagesIcon className="h-4 w-4" />
                Photos
              </button>
            </div>

            {/* Video Upload */}
            {mediaKind === "video" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Video</CardTitle>
                <CardDescription>
                  Upload from your device
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!currentVideo ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="rounded-full bg-muted p-3">
                        <FileVideo className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {isDragging
                            ? "Drop your video here"
                            : "Drag and drop your video here"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          MP4, MOV &middot; Max 500MB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Browse files
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* File Info Row */}
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
                        {videoUrl && (
                          <video
                            src={videoUrl}
                            className="h-full w-full object-cover"
                            muted
                          />
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                            <span className="text-[11px] font-semibold text-white tabular-nums">
                              {uploadProgress}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          title={videoFileName}
                        >
                          {videoFileName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {videoFileInfo && (
                            <span className="text-xs text-muted-foreground">
                              {videoFileInfo}
                            </span>
                          )}
                          {videoDuration > 0 && uploadedFile && (
                            <span className="text-xs text-muted-foreground">
                              &middot; {formatDuration(videoDuration)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={handleRemoveVideo}
                                disabled={isUploading}
                              />
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>Remove video</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Cover Image */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setCoverDialogOpen(true)}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {coverImage ? "Change cover" : "Add cover image"}
                      </Button>
                      {coverImage && (
                        <div className="relative h-10 w-10 rounded overflow-hidden border">
                          <img
                            src={coverImage}
                            alt="Cover"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <Tooltip>
                        <TooltipTrigger
                          render={<span className="inline-flex cursor-help" />}
                        >
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Cover images are supported on Instagram and TikTok
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {/* Platform requirements */}
                <div className="mt-4 rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-medium text-foreground">
                    What can be posted
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <li>MP4 or MOV, up to 500MB — 9:16 vertical works best</li>
                    <li>TikTok: up to 10 minutes</li>
                    <li>Instagram Reels: 3 seconds to 15 minutes</li>
                    <li>YouTube Shorts: up to 3 minutes</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Photo / slideshow Upload */}
            {mediaKind === "photo" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Photos</CardTitle>
                  <CardDescription>
                    Add one photo, or several for a slideshow. They post in the
                    order shown.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleAddImages(e.target.files);
                      e.target.value = "";
                    }}
                  />

                  {images.length === 0 ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files.length)
                          handleAddImages(e.dataTransfer.files);
                      }}
                      className={cn(
                        "relative rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/40",
                      )}
                    >
                      <div className="flex flex-col items-center gap-4">
                        <div className="rounded-full bg-muted p-3">
                          <ImagesIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {isDragging
                              ? "Drop your photos here"
                              : "Drag and drop your photos here"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPG, PNG, WebP &middot; up to {MAX_SLIDESHOW_IMAGES}{" "}
                            images
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Browse photos
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {images.map((img, index) => (
                          <div
                            key={img.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", img.id);
                              setDragImageId(img.id);
                            }}
                            onDragEnd={() => {
                              setDragImageId(null);
                              setDropTargetId(null);
                            }}
                            onDragOver={(e) => {
                              if (!dragImageId || dragImageId === img.id)
                                return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              setDropTargetId(img.id);
                            }}
                            onDragLeave={() => {
                              if (dropTargetId === img.id)
                                setDropTargetId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragImageId) {
                                handleReorderImage(dragImageId, index);
                              }
                              setDragImageId(null);
                              setDropTargetId(null);
                            }}
                            className={cn(
                              "group relative aspect-square cursor-grab overflow-hidden rounded-lg border bg-muted transition-all active:cursor-grabbing",
                              dragImageId === img.id && "opacity-40",
                              dropTargetId === img.id &&
                                dragImageId !== img.id &&
                                "ring-2 ring-primary scale-95",
                            )}
                          >
                            <img
                              src={img.previewUrl}
                              alt={`Slide ${index + 1}`}
                              draggable={false}
                              className="h-full w-full object-cover"
                            />

                            {/* Order badge */}
                            <div className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1.5 text-[11px] font-semibold text-white">
                              {index + 1}
                            </div>

                            {/* Instagram aspect-ratio warning */}
                            {hasInstagram && isInstagramRatioInvalid(img) && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <div className="absolute bottom-1.5 left-1/2 flex h-5 -translate-x-1/2 items-center gap-1 rounded-full bg-amber-500/90 px-1.5 text-[10px] font-semibold text-black" />
                                  }
                                >
                                  <AlertTriangle className="h-3 w-3" weight="fill" />
                                  Ratio
                                </TooltipTrigger>
                                <TooltipContent>
                                  {img.width}×{img.height} — Instagram needs
                                  between 4:5 and 1.91:1
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Uploading overlay */}
                            {img.uploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                                <Spinner className="text-white" />
                              </div>
                            )}

                            {/* Error overlay */}
                            {img.error && (
                              <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-center text-[11px] font-medium text-white">
                                Upload failed
                              </div>
                            )}

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img.id)}
                              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity hover:bg-black/90 group-hover:opacity-100"
                              aria-label="Remove photo"
                            >
                              <X className="h-3 w-3" />
                            </button>

                            {/* Reorder */}
                            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleMoveImage(img.id, -1)}
                                disabled={index === 0}
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-30"
                                aria-label="Move left"
                              >
                                <CaretLeft className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveImage(img.id, 1)}
                                disabled={index === images.length - 1}
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-30"
                                aria-label="Move right"
                              >
                                <CaretRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Add more tile */}
                        {images.length < MAX_SLIDESHOW_IMAGES && (
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
                          >
                            <ImagePlus className="h-6 w-6" />
                            <span className="text-xs font-medium">Add</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {images.length}/{MAX_SLIDESHOW_IMAGES} photos
                          {images.length > 1 &&
                            " · drag to reorder · first photo is the cover"}
                        </span>
                      </div>

                      {instagramOverImageLimit && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            Instagram allows up to {INSTAGRAM_MAX_IMAGES} photos
                            per post. Remove{" "}
                            {images.length - INSTAGRAM_MAX_IMAGES} to continue,
                            or deselect your Instagram account.
                          </AlertDescription>
                        </Alert>
                      )}

                      {instagramBadRatioSlides.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Unsupported aspect ratio</AlertTitle>
                          <AlertDescription className="text-sm">
                            Instagram only accepts images between 4:5
                            (portrait) and 1.91:1 (landscape). Photo
                            {instagramBadRatioSlides.length === 1 ? "" : "s"}{" "}
                            {instagramBadRatioSlides.join(", ")}{" "}
                            {instagramBadRatioSlides.length === 1
                              ? "is"
                              : "are"}{" "}
                            outside that range — crop{" "}
                            {instagramBadRatioSlides.length === 1
                              ? "it"
                              : "them"}{" "}
                            or deselect your Instagram account.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {/* Platform requirements */}
                  <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <p className="text-xs font-medium text-foreground">
                      What can be posted
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <li>
                        JPG, PNG or WebP — converted to JPEG automatically and
                        resized to fit 1080×1920
                      </li>
                      <li>
                        TikTok: up to {MAX_SLIDESHOW_IMAGES} photos, any aspect
                        ratio
                      </li>
                      <li>
                        Instagram: up to {INSTAGRAM_MAX_IMAGES} photos, aspect
                        ratio between 4:5 and 1.91:1 (e.g. 1080×1350 or
                        1080×566)
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* YouTube Details */}
            {selectedAccountsDetails.some(
              (acc) => acc.provider === "google",
            ) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">YouTube details</CardTitle>
                  <CardDescription>
                    Set how your video will appear on YouTube
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="youtube-title" className="text-sm">
                      Title{" "}
                      <span className="text-destructive font-normal">*</span>
                    </Label>
                    <Input
                      id="youtube-title"
                      placeholder="Enter a title for your YouTube video..."
                      value={youtubeTitle}
                      onChange={(e) => setYoutubeTitle(e.target.value)}
                      maxLength={100}
                      className={
                        validationErrors.youtubeTitle
                          ? "border-destructive"
                          : ""
                      }
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Required for YouTube uploads
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {youtubeTitle.length}/100
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="youtube-description" className="text-sm">
                      Description{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      id="youtube-description"
                      placeholder="Write a description for your YouTube video..."
                      value={youtubeDescription}
                      onChange={(e) => setYoutubeDescription(e.target.value)}
                      maxLength={YOUTUBE_MAX_DESCRIPTION_LENGTH}
                      className="min-h-[120px] resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        If left empty, your caption is used as the description
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {youtubeDescription.length}/
                        {YOUTUBE_MAX_DESCRIPTION_LENGTH}
                      </span>
                    </div>
                  </div>

                  {/* Visibility */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Visibility</Label>
                    <Select
                      value={youtubePrivacy}
                      onValueChange={(value) =>
                        value && setYoutubePrivacy(value as YouTubePrivacy)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="unlisted">Unlisted</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      Who can see your video on YouTube
                    </span>
                  </div>

                  {/* Audience */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="youtube-made-for-kids"
                        className="text-sm"
                      >
                        Made for kids
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        YouTube requires you to declare whether your video is
                        made for kids
                      </p>
                    </div>
                    <Switch
                      id="youtube-made-for-kids"
                      checked={youtubeMadeForKids}
                      onCheckedChange={setYoutubeMadeForKids}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Caption */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Caption</CardTitle>
                <CardDescription>
                  Write a caption that will be shared across all selected
                  accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Write your caption here..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={maxCaptionLength}
                    className="min-h-[180px] resize-none"
                  />
                  <div className="flex justify-end mt-1.5">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {caption.length}/{maxCaptionLength}
                    </span>
                  </div>
                </div>

                {/* Custom Captions */}
                {selectedAccounts.length > 0 && (
                  <Collapsible
                    open={captionsOpen}
                    onOpenChange={setCaptionsOpen}
                  >
                    <CollapsibleTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground"
                        />
                      }
                    >
                      <span className="text-sm">
                        Customize caption per account
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          captionsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      <AccountCaptions
                        selectedAccounts={selectedAccountsDetails}
                        accountCaptions={accountCaptions}
                        onCaptionChange={handleAccountCaptionChange}
                        mainCaption={caption}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Sidebar ─── */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {mediaKind === "photo" ? (
                  images.length > 0 ? (
                    <SlideshowPreview
                      images={images}
                      onReorder={handleReorderImage}
                    />
                  ) : (
                    <div className="py-10 text-center">
                      <div className="flex justify-center mb-3">
                        <div className="rounded-full bg-muted p-3">
                          <ImagesIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No photos selected
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add photos to preview
                      </p>
                    </div>
                  )
                ) : currentVideo ? (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden bg-muted">
                      {videoUrl && (
                        <video
                          src={videoUrl}
                          className="w-full object-contain"
                          controls={!isUploading}
                        />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
                          <div className="relative flex h-16 w-16 items-center justify-center">
                            <svg
                              className="absolute inset-0 -rotate-90"
                              viewBox="0 0 36 36"
                            >
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="3"
                              />
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${(uploadProgress / 100) * 100.53} 100.53`}
                                className="transition-all duration-200"
                              />
                            </svg>
                            <span className="text-sm font-semibold text-white tabular-nums">
                              {uploadProgress}%
                            </span>
                          </div>
                          <span className="text-xs font-medium text-white/90">
                            Uploading video…
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p
                        className="text-xs text-muted-foreground truncate flex-1"
                        title={videoFileName}
                      >
                        {videoFileName}
                      </p>
                      {videoDuration > 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatDuration(videoDuration)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="rounded-full bg-muted p-3">
                        <FileVideo className="h-6 w-6 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No video selected
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload or import to preview
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Publish */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Schedule Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="schedule-toggle" className="text-sm">
                    Schedule for later
                  </Label>
                  <Switch
                    id="schedule-toggle"
                    checked={scheduleEnabled}
                    onCheckedChange={handleScheduleToggle}
                  />
                </div>

                {scheduleEnabled && (
                  <div className="space-y-3">
                    <Separator />
                    {/* Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Date
                      </Label>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              className="w-full justify-start gap-2 text-sm"
                            />
                          }
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          {scheduledDate
                            ? format(scheduledDate, "PPP")
                            : "Select date"}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={scheduledDate}
                            onSelect={handleDateSelect}
                            disabled={(date) => date < today}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Time */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Time
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={
                            scheduledDate
                              ? scheduledDate
                                  .getHours()
                                  .toString()
                                  .padStart(2, "0")
                              : "12"
                          }
                          onValueChange={handleHourChange}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Hour" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem
                                key={i}
                                value={i.toString().padStart(2, "0")}
                              >
                                {i.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-lg font-semibold text-muted-foreground">
                          :
                        </span>
                        <Select
                          value={
                            scheduledDate
                              ? scheduledDate
                                  .getMinutes()
                                  .toString()
                                  .padStart(2, "0")
                              : "00"
                          }
                          onValueChange={handleMinuteChange}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Min" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 60 }, (_, i) => (
                              <SelectItem
                                key={i}
                                value={i.toString().padStart(2, "0")}
                              >
                                {i.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Timezone */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Timezone
                      </Label>
                      <TimezoneSelect
                        value={scheduleTimezone}
                        onValueChange={setScheduleTimezone}
                      />
                    </div>

                    {isPastTime && (
                      <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                        <Info className="h-3 w-3 shrink-0" />
                        <span>
                          Selected time is in the past. Choose a future time.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  {scheduleEnabled ? (
                    <Button
                      className="w-full gap-2"
                      disabled={
                        !canSubmit ||
                        isPastTime ||
                        !scheduledDate ||
                        hasValidationErrors
                      }
                      onClick={handleSchedule}
                    >
                      {isPublishing ? (
                        <>
                          <Spinner />
                          {isUploading ? "Uploading..." : "Scheduling..."}
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4" />
                          Schedule post
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full gap-2"
                      disabled={!canSubmit || hasValidationErrors}
                      onClick={handlePostNow}
                    >
                      {isPublishing ? (
                        <>
                          <Spinner />
                          {isUploading ? "Uploading..." : "Publishing..."}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Publish now
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={!canSubmit}
                    onClick={handleSaveDraft}
                  >
                    <Save className="h-4 w-4" />
                    Save as draft
                  </Button>

                  {selectedAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      Select at least one account to continue
                    </p>
                  )}

                  {tiktokAccounts.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      After publishing, it may take a few minutes for your
                      content to process and appear on your TikTok profile.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ─── Dialogs ─── */}
      <ImportVideoDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImportVideo}
      />

      <CoverImageDialog
        open={coverDialogOpen}
        onOpenChange={setCoverDialogOpen}
        videoUrl={videoUrl}
        videoAspectRatio={videoAspectRatio}
        currentCover={coverImage}
        onSetCover={setCoverImage}
      />

      <Dialog
        open={isSubmitting}
        onOpenChange={() => {
          // Non-cancelable: ignore outside clicks, escape, and other dismiss requests.
        }}
        modal
        disablePointerDismissal
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-sm"
          finalFocus={false}
        >
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                submissionSuccess
                  ? "bg-success/15 text-success"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {submissionSuccess ? (
                <CheckCircle className="h-7 w-7" weight="fill" />
              ) : (
                <Spinner className="h-7 w-7" />
              )}
            </div>

            <div className="space-y-1.5">
              <DialogTitle className="text-base font-medium">
                {submissionSuccess
                  ? submissionCopy.success
                  : submissionCopy.active}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {submissionSuccess
                  ? submissionCopy.successMessage
                  : submissionCopy.activeMessage}
              </DialogDescription>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
