import { useState, useCallback, useEffect, useRef } from "react";
import { VideoFile } from "@/types/video";
import {
  createVideoFile,
  validateVideoFileWithDuration,
  VideoAction,
} from "@/lib/video-utils";
import { uploadFileToStorage } from "@/lib/storage-client";
import { toast } from "sonner";

function truncateFileName(fileName: string, maxLength = 30): string {
  if (fileName.length <= maxLength) return fileName;
  const extension = fileName.split(".").pop();
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
  const truncatedName = nameWithoutExt.substring(
    0,
    maxLength - (extension?.length ?? 0) - 4,
  );
  return `${truncatedName}...${extension}`;
}

/**
 * Local video queue for the upload-based video tools: validates duration,
 * uploads each file to storage right away and tracks progress.
 */
export function useVideoManager(
  maxFiles: number = 20,
  action: VideoAction = "process-video",
) {
  const [videos, setVideos] = useState<VideoFile[]>([]);

  // Revoke preview URLs when the form unmounts.
  const videosRef = useRef<VideoFile[]>([]);
  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);
  useEffect(
    () => () => {
      videosRef.current.forEach((video) => {
        if (video.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(video.previewUrl);
        }
      });
    },
    [],
  );

  const uploadVideoFile = useCallback(async (videoFile: VideoFile) => {
    if (!videoFile.file) return;

    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoFile.id
          ? { ...v, uploadStatus: "uploading", uploadProgress: 0 }
          : v,
      ),
    );

    try {
      const result = await uploadFileToStorage(videoFile.file, (progress) => {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoFile.id
              ? { ...v, uploadProgress: progress.percentage }
              : v,
          ),
        );
      });

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

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
            : v,
        ),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoFile.id
            ? { ...v, uploadStatus: "failed", uploadError: errorMessage }
            : v,
        ),
      );
      toast.error(`Couldn't upload ${videoFile.name}. ${errorMessage}`);
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
        toast.error(`You can add up to ${maxFiles} videos at a time.`);
        return;
      }

      for (const file of fileArray) {
        if (videos.some((v) => v.name === file.name)) {
          duplicates.push(truncateFileName(file.name));
          continue;
        }

        try {
          const validation = await validateVideoFileWithDuration(file, action);
          if (validation.valid) {
            const videoFile = createVideoFile(file);
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
        } catch {
          errors.push(`${file.name}: couldn't read this video.`);
        }
      }

      if (duplicates.length > 0) {
        toast.warning(
          duplicates.length === 1
            ? `${duplicates[0]} is already added.`
            : `Skipped ${duplicates.length} videos that are already added.`,
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
        validFiles.forEach((videoFile) => {
          void uploadVideoFile(videoFile);
        });
      }
    },
    [videos, maxFiles, action, uploadVideoFile],
  );

  const removeVideo = useCallback((id: string) => {
    setVideos((prev) => {
      const video = prev.find((v) => v.id === id);
      if (video?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(video.previewUrl);
      }
      return prev.filter((v) => v.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setVideos((prev) => {
      prev.forEach((video) => {
        if (video.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(video.previewUrl);
        }
      });
      return [];
    });
  }, []);

  return {
    videos,
    handleFiles,
    removeVideo,
    clearAll,
  };
}
