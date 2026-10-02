import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { type ProcessedVideo } from "@/hooks/use-videos-query";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { DURATION_LIMITS } from "@/constant";
import {
  uploadFileToStorage,
  type UploadProgress,
  getSignedUploadUrl,
  uploadToSignedUrl,
} from "@/lib/storage-client";
import { type TikTokPostSettings } from "@/lib/tiktok-post-settings";

interface ValidationErrors {
  duration?: string[];
  youtubeTitle?: string;
}

/** Whether the post is a single video (reel) or a set of photos (slideshow). */
export type MediaKind = "video" | "photo";

/** YouTube video visibility, mirrors the API's privacyStatus values. */
export type YouTubePrivacy = "public" | "unlisted" | "private";

/** YouTube limits descriptions to 5000 characters. */
export const YOUTUBE_MAX_DESCRIPTION_LENGTH = 5000;

/** A single image in a photo/slideshow post, tracked through its upload. */
export interface PostImage {
  id: string;
  /** Local object URL for instant preview. */
  previewUrl: string;
  /** Hosted URL once the upload finishes; null while uploading. */
  uploadedUrl: string | null;
  uploading: boolean;
  progress: number;
  error?: boolean;
  /** Natural dimensions, measured async after the image is added. */
  width?: number;
  height?: number;
}

/** Instagram caps carousels at 10 images; TikTok allows up to 35. */
export const MAX_SLIDESHOW_IMAGES = 35;
export const INSTAGRAM_MAX_IMAGES = 10;

/**
 * Instagram only publishes feed/carousel images with an aspect ratio between
 * 4:5 (portrait) and 1.91:1 (landscape); anything else is rejected with
 * "Invalid aspect ratio" (code 36003). Small tolerance for rounding.
 */
export const INSTAGRAM_MIN_RATIO = 0.8 - 0.01;
export const INSTAGRAM_MAX_RATIO = 1.91 + 0.01;

/** True when the image's ratio is outside Instagram's supported range. */
export function isInstagramRatioInvalid(img: PostImage): boolean {
  if (!img.width || !img.height) return false;
  const ratio = img.width / img.height;
  return ratio < INSTAGRAM_MIN_RATIO || ratio > INSTAGRAM_MAX_RATIO;
}

let imageIdCounter = 0;
const nextImageId = () => `img-${++imageIdCounter}`;

/**
 * Re-encode an image to JPEG (optionally downscaled) so it satisfies both
 * platforms: TikTok photo posts accept only JPEG/WebP and Instagram accepts
 * only JPEG. PNG/WebP uploads would otherwise be rejected with
 * `file_format_check_failed`. Transparent pixels are flattened onto white.
 *
 * Images are fit within 1080×1920: TikTok rejects photos above 1080p with
 * `picture_size_check_failed`, and 1080px width is also Instagram's
 * recommended carousel size.
 */
export async function convertImageToJpeg(
  file: File,
  maxWidth = 1080,
  maxHeight = 1920,
  quality = 0.92,
): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  if (scale < 1) {
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  // Flatten transparency onto white so PNGs don't render black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) throw new Error("Failed to encode image");

  const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}

/**
 * All posts default to public. TikTok accounts always receive these settings;
 * there is no per-post TikTok configuration UI.
 */
const DEFAULT_TIKTOK_SETTINGS: TikTokPostSettings = {
  privacy_level: "PUBLIC_TO_EVERYONE",
  disable_comment: false,
  disable_duet: false,
  disable_stitch: false,
  brand_content_toggle: false,
  brand_organic_toggle: false,
  is_aigc: false,
};

export function usePostForm() {
  const [caption, setCaption] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [importedVideo, setImportedVideo] = useState<ProcessedVideo | null>(
    null,
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accountCaptions, setAccountCaptions] = useState<
    Record<string, string>
  >({});
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    undefined,
  );
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubePrivacy, setYoutubePrivacy] =
    useState<YouTubePrivacy>("public");
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind>("video");
  const [images, setImages] = useState<PostImage[]>([]);
  const uploadIdRef = useRef(0);

  const { data: connectedAccounts } = useConnectedAccounts();

  const selectedAccountsDetails = useMemo(
    () =>
      connectedAccounts?.filter((acc) => selectedAccounts.includes(acc.id)) ||
      [],
    [connectedAccounts, selectedAccounts],
  );

  // Validate video against platform requirements
  const validateVideo = (duration: number) => {
    // Duration validation
    const durationIssues: string[] = [];
    if (duration > DURATION_LIMITS.system) {
      durationIssues.push(
        `Video exceeds system limit of ${Math.floor(
          DURATION_LIMITS.system / 60,
        )}:${String(DURATION_LIMITS.system % 60).padStart(2, "0")}`,
      );
    }

    // Check platform-specific limits only if accounts are selected
    const hasTwitter = selectedAccountsDetails.some(
      (acc) => acc.provider.toLowerCase() === "twitter",
    );
    const hasYouTube = selectedAccountsDetails.some(
      (acc) => acc.provider.toLowerCase() === "google",
    );

    if (hasTwitter && duration > DURATION_LIMITS.twitter) {
      durationIssues.push(
        `Twitter/X: Max 2:20 (current: ${Math.floor(duration / 60)}:${String(
          Math.floor(duration % 60),
        ).padStart(2, "0")})`,
      );
    }

    if (hasYouTube && duration > DURATION_LIMITS.youtube) {
      durationIssues.push(
        `YouTube Shorts: Max 3:00 (current: ${Math.floor(
          duration / 60,
        )}:${String(Math.floor(duration % 60)).padStart(2, "0")})`,
      );
    }

    // Update only the duration error, preserve other errors
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      if (durationIssues.length > 0) {
        newErrors.duration = durationIssues;
      } else {
        delete newErrors.duration;
      }
      return newErrors;
    });
  };

  // Extract video metadata and aspect ratio
  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setVideoUrl(url);

      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight;
        const duration = video.duration;
        setVideoAspectRatio(ratio);
        setVideoDuration(duration);

        // Validate video (updates validation errors internally)
        validateVideo(duration);
      };

      return () => URL.revokeObjectURL(url);
    } else if (importedVideo) {
      const url =
        importedVideo.processedAsset?.url ||
        importedVideo.originalAsset?.url ||
        "";
      setVideoUrl(url);

      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight;
        const duration = video.duration;
        setVideoAspectRatio(ratio);
        setVideoDuration(duration);

        // Validate video (updates validation errors internally)
        validateVideo(duration);
      };
    } else {
      setVideoUrl(null);
      setVideoAspectRatio(16 / 9);
      setValidationErrors({});
    }
  }, [uploadedFile, importedVideo, selectedAccountsDetails]);

  // Check if YouTube is selected and title is required
  useEffect(() => {
    const hasYouTube = selectedAccountsDetails.some(
      (acc) => acc.provider.toLowerCase() === "google",
    );

    if (hasYouTube && !youtubeTitle.trim()) {
      setValidationErrors((prev) => ({
        ...prev,
        youtubeTitle: "YouTube title is required for YouTube uploads",
      }));
    } else {
      setValidationErrors((prev) => {
        const { youtubeTitle, ...rest } = prev;
        return rest;
      });
    }
  }, [selectedAccountsDetails, youtubeTitle]);

  const startVideoUpload = useCallback(async (file: File) => {
    const myId = ++uploadIdRef.current;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedVideoUrl(null);

    try {
      const result = await uploadFileToStorage(
        file,
        (progress: UploadProgress) => {
          if (uploadIdRef.current !== myId) return;
          setUploadProgress(progress.percentage);
        },
      );

      if (uploadIdRef.current !== myId) return;

      if (result.success && result.blobUrl) {
        setUploadedVideoUrl(result.blobUrl);
      } else {
        toast.error(result.error || "Failed to upload video");
        setUploadedFile(null);
        setVideoUrl(null);
      }
    } catch (error) {
      if (uploadIdRef.current !== myId) return;
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload video",
      );
      setUploadedFile(null);
      setVideoUrl(null);
    } finally {
      if (uploadIdRef.current === myId) {
        setIsUploading(false);
      }
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setUploadedFile(file);
      setImportedVideo(null);
      setCoverImage(null);
      void startVideoUpload(file);
    }
  };

  const handleImportVideo = (video: ProcessedVideo) => {
    uploadIdRef.current++;
    setImportedVideo(video);
    setUploadedFile(null);
    setCoverImage(null);
    setUploadedVideoUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleRemoveVideo = () => {
    uploadIdRef.current++;
    setImportedVideo(null);
    setUploadedFile(null);
    setCoverImage(null);
    setVideoUrl(null);
    setUploadedVideoUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleAccountCaptionChange = (accountId: string, caption: string) => {
    setAccountCaptions((prev) => ({
      ...prev,
      [accountId]: caption,
    }));
  };

  // ─── Slideshow / photo images ───

  const uploadImage = useCallback(async (id: string, file: File) => {
    try {
      // Normalize to JPEG for TikTok/Instagram compatibility. If conversion
      // fails for an exotic format, fall back to the original bytes.
      let toUpload = file;
      try {
        toUpload = await convertImageToJpeg(file);
      } catch (conversionError) {
        console.warn("Image JPEG conversion failed, uploading original:", conversionError);
      }
      const result = await uploadFileToStorage(toUpload);
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? result.success && result.blobUrl
              ? {
                  ...img,
                  uploadedUrl: result.blobUrl,
                  uploading: false,
                  progress: 100,
                }
              : { ...img, uploading: false, error: true }
            : img,
        ),
      );
      if (!result.success || !result.blobUrl) {
        toast.error(result.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, uploading: false, error: true } : img,
        ),
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    }
  }, []);

  const handleAddImages = useCallback(
    (files: FileList | File[]) => {
      const picked = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (picked.length === 0) return;

      const remaining = MAX_SLIDESHOW_IMAGES - images.length;
      if (remaining <= 0) {
        toast.error(`You can add up to ${MAX_SLIDESHOW_IMAGES} images.`);
        return;
      }

      const accepted = picked.slice(0, remaining);
      if (accepted.length < picked.length) {
        toast.error(`Only ${MAX_SLIDESHOW_IMAGES} images allowed per post.`);
      }

      const newImages: PostImage[] = accepted.map((file) => ({
        id: nextImageId(),
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        uploading: true,
        progress: 0,
      }));

      setImages((prev) => [...prev, ...newImages]);

      // Measure natural dimensions so platform aspect-ratio rules can be
      // validated before publishing.
      newImages.forEach((img) => {
        const probe = new Image();
        probe.onload = () => {
          setImages((prev) =>
            prev.map((i) =>
              i.id === img.id
                ? { ...i, width: probe.naturalWidth, height: probe.naturalHeight }
                : i,
            ),
          );
        };
        probe.src = img.previewUrl;
      });

      // Kick off uploads outside the state updater so StrictMode's
      // double-invocation can't start duplicate uploads.
      newImages.forEach((img, i) => void uploadImage(img.id, accepted[i]));
    },
    [images.length, uploadImage],
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleMoveImage = useCallback((id: string, direction: -1 | 1) => {
    setImages((prev) => {
      const index = prev.findIndex((img) => img.id === id);
      if (index === -1) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const handleReorderImage = useCallback((id: string, toIndex: number) => {
    setImages((prev) => {
      const from = prev.findIndex((img) => img.id === id);
      if (from === -1) return prev;
      const to = Math.max(0, Math.min(prev.length - 1, toIndex));
      if (from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleClearImages = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  // Switching media kind clears the other kind's media so the payload is
  // always internally consistent.
  const handleMediaKindChange = useCallback(
    (kind: MediaKind) => {
      setMediaKind((current) => {
        if (current === kind) return current;
        if (kind === "photo") {
          handleRemoveVideo();
        } else {
          handleClearImages();
        }
        return kind;
      });
    },
    [handleClearImages],
  );

  const imagesUploading = images.some((img) => img.uploading);

  const uploadVideoIfNeeded = async (): Promise<string | null> => {
    // Imported videos are already hosted; just return the URL.
    if (importedVideo) {
      return (
        importedVideo.processedAsset?.url ||
        importedVideo.originalAsset?.url ||
        null
      );
    }

    // Locally selected files are uploaded immediately on selection,
    // so by the time we submit we should already have the blob URL.
    if (uploadedFile) {
      if (uploadedVideoUrl) {
        return uploadedVideoUrl;
      }
      throw new Error("Video is still uploading. Please wait a moment.");
    }

    return null;
  };

  const uploadCoverImageIfNeeded = async (): Promise<string | null> => {
    if (!coverImage) return null;

    // If cover image is already a URL (not a base64 data URL), return it as is
    if (coverImage.startsWith("http://") || coverImage.startsWith("https://")) {
      return coverImage;
    }

    // If it's a base64 data URL, upload it to storage
    if (coverImage.startsWith("data:image/")) {
      try {
        // Convert base64 to blob
        const response = await fetch(coverImage);
        const blob = await response.blob();

        // Generate a unique filename
        const timestamp = Date.now();
        const fileName = `cover-${timestamp}.jpg`;

        // Create a File object from the blob
        const file = new File([blob], fileName, { type: "image/jpeg" });

        // Get a signed upload URL
        const signed = await getSignedUploadUrl(fileName, file.type);

        if (!signed.success) {
          throw new Error(
            signed.error || "Failed to generate upload URL for cover image",
          );
        }

        // Upload the file
        const result = await uploadToSignedUrl(file, signed);

        if (result.success && result.blobUrl) {
          console.log("✓ Cover image uploaded to storage:", result.blobUrl);
          return result.blobUrl;
        } else {
          throw new Error(result.error || "Failed to upload cover image");
        }
      } catch (error) {
        console.error("Error uploading cover image:", error);
        throw error;
      }
    }

    return coverImage;
  };

  const preparePostData = async () => {
    const media: Array<Record<string, unknown>> = [];
    // Photo posts are stored as CAROUSEL (a single image is just a
    // one-item carousel), video posts as VIDEO.
    let postType: "VIDEO" | "CAROUSEL" = "VIDEO";

    if (mediaKind === "photo") {
      postType = "CAROUSEL";

      if (images.some((img) => img.uploading)) {
        throw new Error("Images are still uploading. Please wait a moment.");
      }

      const readyImages = images.filter((img) => img.uploadedUrl && !img.error);
      readyImages.forEach((img, index) => {
        media.push({
          type: "IMAGE",
          url: img.uploadedUrl,
          order: index,
        });
      });
    } else {
      // Upload video first if needed
      const finalVideoUrl = await uploadVideoIfNeeded();

      // Upload cover image if needed
      const finalCoverImageUrl = await uploadCoverImageIfNeeded();

      // Add video if exists
      if (finalVideoUrl) {
        media.push({
          type: "VIDEO",
          url: finalVideoUrl,
          order: 0,
          duration: videoDuration,
        });
      }

      // Add cover image if exists
      if (finalCoverImageUrl) {
        media.push({
          type: "THUMBNAIL",
          url: finalCoverImageUrl,
          order: 0,
        });
      }
    }

    const accounts = selectedAccounts.map((accountId) => {
      const account = connectedAccounts?.find((acc) => acc.id === accountId);
      const provider = account?.provider.toLowerCase();
      const isYouTube = provider === "google";
      const isTikTok = provider === "tiktok";

      return {
        accountId,
        customCaption: accountCaptions[accountId] || null,
        ...(isYouTube && youtubeTitle ? { title: youtubeTitle } : {}),
        // The per-account caption doubles as the YouTube description; the
        // dedicated description field takes precedence when filled in.
        ...(isYouTube && youtubeDescription.trim()
          ? { customCaption: youtubeDescription }
          : {}),
        ...(isYouTube
          ? {
              settings: {
                privacyStatus: youtubePrivacy,
                madeForKids: youtubeMadeForKids,
              },
            }
          : {}),
        ...(isTikTok ? { settings: DEFAULT_TIKTOK_SETTINGS } : {}),
      };
    });

    return {
      type: postType,
      mainCaption: caption,
      media,
      accounts,
    };
  };

  const currentVideo = importedVideo || uploadedFile;

  return {
    // State
    caption,
    setCaption,
    scheduleEnabled,
    setScheduleEnabled,
    importedVideo,
    uploadedFile,
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
    uploadProgress,
    isUploading,
    uploadedVideoUrl,
    mediaKind,
    images,
    imagesUploading,

    // Handlers
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
  };
}
