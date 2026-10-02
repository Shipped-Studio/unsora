export interface VideoFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  url?: string;
  previewUrl?: string;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
  uploadProgress: number;
  uploadError?: string;
  storageBlobUrl?: string;
  storageBlobName?: string;
  width?: number;
  height?: number;
  duration?: number;
}
