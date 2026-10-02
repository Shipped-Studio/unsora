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
import { getBrowserTimezone, toZonedNaive } from "@/lib/timezone";
import {
  fromTikTokPostSettings,
  toTikTokPostSettings,
  type TikTokOptionsState,
  type TikTokPostSettings,
} from "@/lib/tiktok-post-settings";
import {
  convertImageToJpeg,
  MAX_SLIDESHOW_IMAGES,
  type MediaKind,
  type PostImage,
} from "@/hooks/use-post-form";

let editImageIdCounter = 0;
const nextEditImageId = () => `edit-img-${++editImageIdCounter}`;

interface ValidationErrors {
  duration?: string[];
  youtubeTitle?: string;
}

interface PostData {
  id: string;
  type?: string;
  mainCaption: string;
  youtubeTitle?: string;
  scheduledFor?: string | null;
  scheduledTimezone?: string | null;
  status: string;
  media: Array<{
    id: string;
    type: string;
    order?: number;
    // Some endpoints flatten the URL onto the media row, but the canonical
    // location is on the related Asset.
    url?: string;
    duration?: number;
    asset?: {
      url?: string;
      duration?: number | null;
      width?: number | null;
      height?: number | null;
    } | null;
  }>;
  postAccounts: Array<{
    accountId: string;
    customCaption?: string | null;
    settings?: TikTokPostSettings | null;
    account: {
      id: string;
      provider: string;
      accountName: string;
      accountUsername: string;
      profilePicture?: string | null;
    };
  }>;
}

export function useEditPostForm(postData: PostData | null) {
  const [caption, setCaption] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [importedVideo, setImportedVideo] = useState<ProcessedVideo | null>(
    null
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
    undefined
  );
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(() =>
    getBrowserTimezone(),
  );
  const [tiktokSettings, setTiktokSettings] = useState<
    Record<string, TikTokOptionsState>
  >({});
  const [tiktokValidity, setTiktokValidity] = useState<Record<string, boolean>>(
    {},
  );
  const [mediaKind, setMediaKind] = useState<MediaKind>("video");
  const [images, setImages] = useState<PostImage[]>([]);
  const uploadIdRef = useRef(0);

  const { data: connectedAccounts } = useConnectedAccounts();

  // Initialize form with post data
  useEffect(() => {
    if (postData) {
      setCaption(postData.mainCaption || "");
      setYoutubeTitle(postData.youtubeTitle || "");

      // Set schedule. The server stores `scheduledFor` as the absolute UTC
      // instant and `scheduledTimezone` as the IANA zone the user picked.
      // Reproject the UTC instant into a "naive" Date whose local-component
      // getters report the wall-clock time in the saved timezone so the form
      // shows the same hour/minute/date the user originally entered.
      if (postData.scheduledFor) {
        const tz = postData.scheduledTimezone || getBrowserTimezone();
        setScheduleTimezone(tz);
        setScheduleEnabled(true);
        setScheduledDate(toZonedNaive(new Date(postData.scheduledFor), tz));
      }

      // Set selected accounts
      const accountIds = postData.postAccounts.map((pa) => pa.accountId);
      setSelectedAccounts(accountIds);

      // Set custom captions
      const captions: Record<string, string> = {};
      postData.postAccounts.forEach((pa) => {
        if (pa.customCaption) {
          captions[pa.accountId] = pa.customCaption;
        }
      });
      setAccountCaptions(captions);

      // Pre-populate TikTok options from any previously saved per-account settings.
      const ttSettings: Record<string, TikTokOptionsState> = {};
      postData.postAccounts.forEach((pa) => {
        if (
          pa.account.provider.toLowerCase() === "tiktok" &&
          pa.settings
        ) {
          ttSettings[pa.accountId] = fromTikTokPostSettings(pa.settings);
        }
      });
      setTiktokSettings(ttSettings);

      // Set media – PostMedia stores its URL on the related Asset, so fall
      // back to the flat `url` for backwards compatibility.
      const videoMedia = postData.media.find((m) => m.type === "VIDEO");
      const thumbnailMedia = postData.media.find((m) => m.type === "THUMBNAIL");

      if (videoMedia) {
        const url = videoMedia.asset?.url ?? videoMedia.url ?? null;
        const duration =
          videoMedia.asset?.duration ?? videoMedia.duration ?? 0;
        if (url) {
          setExistingVideoUrl(url);
          setVideoUrl(url);
        }
        setVideoDuration(duration || 0);

        const w = videoMedia.asset?.width;
        const h = videoMedia.asset?.height;
        if (w && h && h > 0) {
          setVideoAspectRatio(w / h);
        }
      }

      if (thumbnailMedia) {
        const coverUrl = thumbnailMedia.asset?.url ?? thumbnailMedia.url ?? null;
        if (coverUrl) {
          setCoverImage(coverUrl);
        }
      }

      // Photo posts: seed the slideshow images from the stored media, in
      // order, and measure their dimensions for aspect-ratio validation.
      if (postData.type === "CAROUSEL" || postData.type === "IMAGE") {
        setMediaKind("photo");

        const existing: PostImage[] = postData.media
          .filter((m) => m.type === "IMAGE")
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .flatMap((m) => {
            const url = m.asset?.url ?? m.url;
            if (!url) return [];
            return [
              {
                id: nextEditImageId(),
                previewUrl: url,
                uploadedUrl: url,
                uploading: false,
                progress: 100,
              },
            ];
          });

        setImages(existing);

        existing.forEach((img) => {
          const probe = new Image();
          probe.onload = () => {
            setImages((prev) =>
              prev.map((i) =>
                i.id === img.id
                  ? {
                      ...i,
                      width: probe.naturalWidth,
                      height: probe.naturalHeight,
                    }
                  : i,
              ),
            );
          };
          probe.src = img.previewUrl;
        });
      }
    }
  }, [postData]);

  // Get selected account details - memoized to prevent infinite loops
  const selectedAccountsDetails = useMemo(
    () =>
      connectedAccounts?.filter((acc) => selectedAccounts.includes(acc.id)) ||
      [],
    [connectedAccounts, selectedAccounts]
  );

  const handleTikTokOptionsChange = useCallback(
    (accountId: string, next: TikTokOptionsState) => {
      setTiktokSettings((prev) => ({ ...prev, [accountId]: next }));
    },
    [],
  );

  const handleTikTokValidityChange = useCallback(
    (accountId: string, valid: boolean) => {
      setTiktokValidity((prev) =>
        prev[accountId] === valid ? prev : { ...prev, [accountId]: valid },
      );
    },
    [],
  );

  const tiktokReady = useMemo(
    () =>
      selectedAccountsDetails
        .filter((acc) => acc.provider.toLowerCase() === "tiktok")
        .every((acc) => tiktokValidity[acc.id] === true),
    [selectedAccountsDetails, tiktokValidity],
  );

  // Validate video against platform requirements
  const validateVideo = (duration: number) => {
    // Duration validation
    const durationIssues: string[] = [];
    if (duration > DURATION_LIMITS.system) {
      durationIssues.push(
        `Video exceeds system limit of ${Math.floor(
          DURATION_LIMITS.system / 60
        )}:${String(DURATION_LIMITS.system % 60).padStart(2, "0")}`
      );
    }

    // Check platform-specific limits only if accounts are selected
    const hasTwitter = selectedAccountsDetails.some(
      (acc) => acc.provider.toLowerCase() === "twitter"
    );
    const hasYouTube = selectedAccountsDetails.some(
      (acc) => acc.provider.toLowerCase() === "google"
    );

    if (hasTwitter && duration > DURATION_LIMITS.twitter) {
      durationIssues.push(
        `Twitter/X: Max 2:20 (current: ${Math.floor(duration / 60)}:${String(
          Math.floor(duration % 60)
        ).padStart(2, "0")})`
      );
    }

    if (hasYouTube && duration > DURATION_LIMITS.youtube) {
      durationIssues.push(
        `YouTube Shorts: Max 3:00 (current: ${Math.floor(
          duration / 60
        )}:${String(Math.floor(duration % 60)).padStart(2, "0")})`
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
    } else if (existingVideoUrl) {
      // Use existing video URL
      const video = document.createElement("video");
      video.src = existingVideoUrl;
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
  }, [uploadedFile, importedVideo, existingVideoUrl, selectedAccountsDetails]);

  // Check if YouTube is selected and title is required
  useEffect(() => {
    const hasYouTube = selectedAccountsDetails.some(
      (acc) => acc.provider.toLowerCase() === "google"
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
        }
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
        error instanceof Error ? error.message : "Failed to upload video"
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
      setExistingVideoUrl(null);
      setCoverImage(null);
      void startVideoUpload(file);
    }
  };

  const handleImportVideo = (video: ProcessedVideo) => {
    uploadIdRef.current++;
    setImportedVideo(video);
    setUploadedFile(null);
    setExistingVideoUrl(null);
    setCoverImage(null);
    setUploadedVideoUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleRemoveVideo = () => {
    uploadIdRef.current++;
    setImportedVideo(null);
    setUploadedFile(null);
    setExistingVideoUrl(null);
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

  const uploadVideoIfNeeded = async (): Promise<string | null> => {
    // If using existing video, return that URL
    if (existingVideoUrl && !uploadedFile && !importedVideo) {
      return existingVideoUrl;
    }

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

    return existingVideoUrl;
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
            signed.error || "Failed to generate upload URL for cover image"
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

  // ─── Slideshow / photo images ───

  const uploadImage = useCallback(async (id: string, file: File) => {
    try {
      // Normalize to JPEG for TikTok/Instagram compatibility. If conversion
      // fails for an exotic format, fall back to the original bytes.
      let toUpload = file;
      try {
        toUpload = await convertImageToJpeg(file);
      } catch (conversionError) {
        console.warn(
          "Image JPEG conversion failed, uploading original:",
          conversionError,
        );
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
        id: nextEditImageId(),
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        uploading: true,
        progress: 0,
      }));

      setImages((prev) => [...prev, ...newImages]);

      // Measure natural dimensions for platform aspect-ratio validation.
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

      newImages.forEach((img, i) => void uploadImage(img.id, accepted[i]));
    },
    [images.length, uploadImage],
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
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

  const imagesUploading = images.some((img) => img.uploading);

  const preparePostData = async () => {
    const media: Array<Record<string, unknown>> = [];
    // Preserve the post's kind: photo posts stay CAROUSEL, video posts VIDEO.
    let postType: "VIDEO" | "CAROUSEL" = "VIDEO";

    if (mediaKind === "photo") {
      postType = "CAROUSEL";

      if (images.some((img) => img.uploading)) {
        throw new Error("Images are still uploading. Please wait a moment.");
      }

      const readyImages = images.filter(
        (img) => img.uploadedUrl && !img.error,
      );
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

    // Prepare accounts with custom captions + per-account TikTok settings
    const accounts = selectedAccounts.map((accountId) => {
      const account = connectedAccounts?.find((acc) => acc.id === accountId);
      const tiktokState =
        account?.provider.toLowerCase() === "tiktok"
          ? tiktokSettings[accountId]
          : undefined;
      return {
        accountId,
        customCaption: accountCaptions[accountId] || null,
        ...(tiktokState
          ? { settings: toTikTokPostSettings(tiktokState) }
          : {}),
      };
    });

    return {
      type: postType,
      mainCaption: caption,
      media,
      accounts,
      youtubeTitle: youtubeTitle || undefined,
    };
  };

  const currentVideo =
    importedVideo ||
    uploadedFile ||
    (existingVideoUrl ? { url: existingVideoUrl } : null);

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
    scheduleTimezone,
    setScheduleTimezone,
    youtubeTitle,
    setYoutubeTitle,
    validationErrors,
    selectedAccountsDetails,
    currentVideo,
    uploadProgress,
    isUploading,
    uploadedVideoUrl,
    existingVideoUrl,
    tiktokSettings,
    tiktokReady,
    mediaKind,
    images,
    imagesUploading,

    // Handlers
    handleFileUpload,
    handleImportVideo,
    handleRemoveVideo,
    handleAccountCaptionChange,
    handleTikTokOptionsChange,
    handleTikTokValidityChange,
    handleAddImages,
    handleRemoveImage,
    handleMoveImage,
    handleReorderImage,
    preparePostData,
  };
}
