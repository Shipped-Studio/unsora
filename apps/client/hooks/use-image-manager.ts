import { useState, useCallback, useEffect, useRef } from "react";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";
import { toast } from "sonner";

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export type ImageUploadStatus = "pending" | "uploading" | "completed" | "failed";

export interface ManagedImage {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  uploadStatus: ImageUploadStatus;
  uploadProgress: number;
  blobUrl?: string;
  uploadError?: string;
}

export function useImageManager(maxFiles: number = 20) {
  const [images, setImages] = useState<ManagedImage[]>([]);

  // Revoke preview URLs when the form unmounts.
  const imagesRef = useRef<ManagedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(
    () => () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    },
    [],
  );

  const uploadImageFile = useCallback(async (imageFile: ManagedImage) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageFile.id
          ? { ...img, uploadStatus: "uploading" as const, uploadProgress: 0 }
          : img,
      ),
    );

    try {
      const signed = await getSignedUploadUrl(
        imageFile.file.name,
        imageFile.file.type,
      );
      if (!signed.success || !signed.uploadUrl) {
        throw new Error(signed.error || "Upload failed");
      }

      const result = await uploadToSignedUrl(
        imageFile.file,
        signed,
        (progress) => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageFile.id
                ? { ...img, uploadProgress: progress.percentage }
                : img,
            ),
          );
        },
      );

      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed");
      }

      setImages((prev) =>
        prev.map((img) =>
          img.id === imageFile.id
            ? {
                ...img,
                uploadStatus: "completed" as const,
                uploadProgress: 100,
                blobUrl: result.blobUrl,
              }
            : img,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageFile.id
            ? { ...img, uploadStatus: "failed" as const, uploadError: message }
            : img,
        ),
      );
      toast.error(`Couldn't upload ${imageFile.name}. ${message}`);
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      if (images.length + fileArray.length > maxFiles) {
        toast.error(`You can add up to ${maxFiles} images at a time.`);
        return;
      }

      const validFiles: ManagedImage[] = [];
      const errors: string[] = [];
      const duplicates: string[] = [];

      for (const file of fileArray) {
        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
          errors.push(`${file.name}: use a JPEG, PNG or WebP image.`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          errors.push(`${file.name}: larger than ${MAX_FILE_SIZE_MB} MB.`);
          continue;
        }

        const isDuplicate = images.some((img) => img.name === file.name);
        if (isDuplicate) {
          duplicates.push(file.name);
          continue;
        }

        validFiles.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          uploadStatus: "pending",
          uploadProgress: 0,
        });
      }

      if (duplicates.length > 0) {
        toast.warning(
          duplicates.length === 1
            ? `${duplicates[0]} is already added.`
            : `Skipped ${duplicates.length} images that are already added.`,
        );
      }

      if (errors.length > 0) {
        toast.error(errors.join("\n"), { duration: 5000 });
      }

      if (validFiles.length > 0) {
        setImages((prev) => [...prev, ...validFiles]);
        validFiles.forEach((img) => uploadImageFile(img));
      }
    },
    [images, maxFiles, uploadImageFile],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  return { images, handleFiles, removeImage, clearAll };
}
