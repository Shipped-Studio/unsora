import { useState, useCallback } from "react";
import { VideoFile } from "@/types/video";
import {
  createVideoFile,
  validateVideoFileWithDuration,
  VideoAction,
} from "@/lib/video-utils";
import { uploadFileToStorage } from "@/lib/storage-client";
import { toast } from "sonner";

export function useVideoManager(
  maxFiles: number = 20,
  action: VideoAction = "process-video"
) {
  const [videos, setVideos] = useState<VideoFile[]>([]);

  const truncateFileName = useCallback(
    (fileName: string, maxLength: number = 30): string => {
      if (fileName.length <= maxLength) return fileName;
      const extension = fileName.split(".").pop();
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
      const truncatedName = nameWithoutExt.substring(
        0,
        maxLength - (extension?.length ?? 0) - 4
      );
      return `${truncatedName}...${extension}`;
    },
    []
  );

  const uploadVideoFile = useCallback(async (videoFile: VideoFile) => {
    if (!videoFile.file) return;

    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoFile.id
          ? { ...v, uploadStatus: "uploading", uploadProgress: 0 }
          : v
      )
    );

    try {
      const result = await uploadFileToStorage(videoFile.file, (progress) => {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoFile.id
              ? { ...v, uploadProgress: progress.percentage }
              : v
          )
        );
      });

      if (result.success) {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoFile.id
              ? {
                  ...v,
                  uploadStatus: "completed",
                  uploadProgress: 100,
                  storageBlobUrl: result.blobUrl,
                  storageBlobName: result.blobName,
                }
              : v
          )
        );
        toast.success(`${videoFile.name} uploaded successfully!`);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoFile.id
            ? { ...v, uploadStatus: "failed", uploadError: errorMessage }
            : v
        )
      );
      toast.error(`Failed to upload ${videoFile.name}: ${errorMessage}`);
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: VideoFile[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      const duplicates: string[] = [];

      if (videos.length + fileArray.length > maxFiles) {
        toast.error(`You can only upload up to ${maxFiles} videos at once.`);
        return;
      }

      for (const file of fileArray) {
        const isDuplicate = videos.some((v) => v.name === file.name);
        if (isDuplicate) {
          duplicates.push(truncateFileName(file.name));
          continue;
        }

        try {
          const validation = await validateVideoFileWithDuration(file, action);
          if (validation.valid) {
            const videoFile = createVideoFile(file);
            videoFile.uploadStatus = "pending";
            videoFile.uploadProgress = 0;

            if (validation.metadata) {
              videoFile.width = validation.metadata.width;
              videoFile.height = validation.metadata.height;
              videoFile.duration = validation.metadata.duration;
            }

            validFiles.push(videoFile);

            if (validation.warning) {
              warnings.push(`${file.name}: ${validation.warning}`);
            }
          } else {
            errors.push(`${file.name}: ${validation.error}`);
          }
        } catch (error) {
          errors.push(`${file.name}: Failed to validate video`);
        }
      }

      if (duplicates.length > 0) {
        toast.warning(
          duplicates.length === 1
            ? `"${duplicates[0]}" is already in your upload queue.`
            : `${
                duplicates.length
              } duplicate video(s) skipped: ${duplicates.join(", ")}`,
          { duration: 4000 }
        );
      }

      if (errors.length > 0) {
        toast.error(errors.join("\n"), { duration: 5000 });
      }

      if (warnings.length > 0) {
        toast.warning(warnings.join("\n"), { duration: 4000 });
      }

      if (validFiles.length > 0) {
        setVideos((prev) => [...prev, ...validFiles]);
        toast.success(
          `${validFiles.length} video(s) added. Starting upload...`
        );

        validFiles.forEach(async (videoFile) => {
          await uploadVideoFile(videoFile);
        });
      }
    },
    [videos, maxFiles, uploadVideoFile, truncateFileName]
  );

  const handleUrlSubmit = useCallback(
    (urlInput: string) => {
      const urls = urlInput
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      if (urls.length === 0) {
        toast.error("Please enter at least one URL.");
        return false;
      }

      if (videos.length + urls.length > maxFiles) {
        toast.error(`You can only add up to ${maxFiles} videos at once.`);
        return false;
      }

      const validUrls: VideoFile[] = [];
      const invalidUrls: string[] = [];
      const soraUrlPattern =
        /^https:\/\/sora\.chatgpt\.com\/p\/s_[a-zA-Z0-9]+$/;

      urls.forEach((url, index) => {
        if (!soraUrlPattern.test(url)) {
          invalidUrls.push(url);
          return;
        }

        const isDuplicate = videos.some((v) => v.url === url);
        if (isDuplicate) {
          toast.warning(`URL already added: ${url}`);
          return;
        }

        const videoId = url.split("/p/")[1];
        const videoFile: VideoFile = {
          id: `url-${Date.now()}-${index}`,
          name: `Sora Video: ${videoId}`,
          size: 0,
          type: "video/url",
          url: url,
          uploadStatus: "completed",
          uploadProgress: 100,
        };

        validUrls.push(videoFile);
      });

      if (invalidUrls.length > 0) {
        toast.error(
          `Invalid Sora URL format. URLs must be in the format:\nhttps://sora.chatgpt.com/p/s_...\n\nInvalid URLs:\n${invalidUrls.join(
            "\n"
          )}`,
          { duration: 6000 }
        );
      }

      if (validUrls.length > 0) {
        setVideos((prev) => [...prev, ...validUrls]);
        toast.success(`${validUrls.length} Sora video(s) added successfully!`);
        return true;
      }

      return false;
    },
    [videos, maxFiles]
  );

  const addAssetVideo = useCallback(
    (asset: { name: string; url: string }) => {
      if (videos.length >= maxFiles) {
        toast.error(`You can only add up to ${maxFiles} videos at once.`);
        return;
      }

      const isDuplicate = videos.some(
        (v) => v.storageBlobUrl === asset.url || v.url === asset.url,
      );
      if (isDuplicate) {
        toast.warning("This asset is already in your queue.");
        return;
      }

      const videoFile: VideoFile = {
        id: `asset-${Date.now()}`,
        name: asset.name || "Library asset",
        size: 0,
        type: "video/mp4",
        previewUrl: asset.url,
        storageBlobUrl: asset.url,
        uploadStatus: "completed",
        uploadProgress: 100,
      };

      setVideos((prev) => [...prev, videoFile]);
      toast.success(`${videoFile.name} added from library`);
    },
    [videos, maxFiles],
  );

  const removeVideo = useCallback((id: string) => {
    setVideos((prev) => prev.filter((video) => video.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setVideos([]);
  }, []);

  return {
    videos,
    handleFiles,
    handleUrlSubmit,
    addAssetVideo,
    removeVideo,
    clearAll,
    truncateFileName,
  };
}
