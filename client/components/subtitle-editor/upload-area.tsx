"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UploadSimple, FileVideo, CheckCircle, X } from "@phosphor-icons/react";
import { uploadFileToStorage, type UploadProgress } from "@/lib/storage-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";

interface UploadAreaProps {
  onVideoUploaded: (url: string, file: File) => void;
  onUploaded?: () => void;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

function CircularUploadProgress({ progress }: { progress: number }) {
  const size = 104;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient id="upload-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8ff6b" />
            <stop offset="100%" stopColor="#7a9a20" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#upload-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          style={{
            transition: "stroke-dashoffset 0.3s ease",
            filter: "drop-shadow(0 0 8px rgba(232,255,107,0.55))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-white">
          {Math.round(progress)}
          <span className="text-xs font-semibold text-white/70">%</span>
        </span>
      </div>
    </div>
  );
}

export function UploadArea({
  onVideoUploaded,
  onUploaded,
  className,
  padding = "md",
}: UploadAreaProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      const preview = URL.createObjectURL(selectedFile);
      setFile(selectedFile);
      setPreviewUrl(preview);
      setUploading(true);
      setProgress(0);

      try {
        const result = await uploadFileToStorage(
          selectedFile,
          (p: UploadProgress) => {
            setProgress(p.percentage);
          },
        );

        if (result.success && result.blobUrl) {
          setUploading(false);
          setProgress(100);
          onVideoUploaded(result.blobUrl, selectedFile);
          onUploaded?.();
          toast.success("Video uploaded successfully");
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
        URL.revokeObjectURL(preview);
        setFile(null);
        setPreviewUrl(null);
        setUploading(false);
        setProgress(0);
      }
    },
    [onVideoUploaded, onUploaded],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = "";
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (!f || !f.type.startsWith("video/")) {
        toast.error("Please drop a video file");
        return;
      }
      handleFile(f);
    },
    [handleFile],
  );

  const preventDefault = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const clearFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setUploading(false);
    setProgress(0);
  }, [previewUrl]);

  const paddingClass =
    padding === "lg" ? "p-12" : padding === "sm" ? "p-6" : "p-8";

  if (file) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl", className)}>
        {previewUrl && (
          <video
            src={previewUrl}
            className="h-64 w-full bg-black object-cover"
            muted
            playsInline
            autoPlay
            loop
          />
        )}

        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-[3px]">
            <CircularUploadProgress progress={progress} />
            <div className="px-6 text-center">
              <p className="text-sm font-medium text-white">
                Uploading your video...
              </p>
              <p className="mt-0.5 max-w-full truncate text-xs text-white/60">
                {file.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
            <CheckCircle className="size-4 text-success" weight="fill" />
            <span className="truncate text-xs font-medium text-white">
              {file.name}
            </span>
          </div>
        )}

        <button
          onClick={clearFile}
          disabled={uploading}
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-background border border-dashed border-border transition-colors hover:border-primary/40",
        paddingClass,
        className,
      )}
      onDrop={handleDrop}
      onDragOver={preventDefault}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <FileVideo className="size-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Drag & drop your video here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, WebM, MOV supported
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimple className="size-4" />
          Browse Files
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
