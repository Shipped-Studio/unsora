"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Info, UploadSimple as Upload } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";

interface CoverImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  videoAspectRatio: number;
  currentCover: string | null;
  onSetCover: (coverImage: string) => void;
}

export function CoverImageDialog({
  open,
  onOpenChange,
  videoUrl,
  videoAspectRatio,
  currentCover,
  onSetCover,
}: CoverImageDialogProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL("image/jpeg");
        setCapturedFrame(frameData);
      }
    }
  };

  const handleSliderChange = (value: number | readonly number[]) => {
    const arr = Array.isArray(value) ? value : [value];
    const time = arr[0];
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedFrame(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSetCover = () => {
    if (capturedFrame) {
      onSetCover(capturedFrame);
      onOpenChange(false);
      setCapturedFrame(null);
      setCurrentTime(0);
    }
  };

  useEffect(() => {
    if (videoRef.current && currentTime > 0) {
      captureFrame();
    }
  }, [currentTime]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Select Cover Frame</DialogTitle>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex cursor-help" />}>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Cover images are only supported on Instagram and TikTok</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <DialogDescription>
            Upload a custom image or select a frame from your video
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Custom Cover Button */}
          <div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => coverInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload Custom Cover
            </Button>
          </div>

          {/* Preview Section */}
          <div className="grid grid-cols-2 gap-4">
            {/* New Cover Image */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">New cover image</Label>
              <div
                className="relative max-w-[200px] mt-2 bg-muted rounded-lg overflow-hidden flex items-center justify-center"
                style={{ aspectRatio: videoAspectRatio }}
              >
                {capturedFrame ? (
                  <img
                    src={capturedFrame}
                    alt="New cover"
                    className="aspect-[9/16] object-cover"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a frame below
                  </p>
                )}
              </div>
            </div>

            {/* Current Cover */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current cover</Label>
              <div
                className="relative max-w-[200px] mt-2 bg-muted rounded-lg overflow-hidden flex items-center justify-center"
                style={{ aspectRatio: videoAspectRatio }}
              >
                {currentCover ? (
                  <img
                    src={currentCover}
                    alt="Current cover"
                    className="object-cover"
                  />
                ) : (
                  <div className="text-center space-y-1">
                    <p className="text-sm text-muted-foreground">
                      No cover selected
                    </p>
                    <Tooltip>
                      <TooltipTrigger render={<span className="inline-flex mx-auto cursor-help" />}>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select a frame or upload an image</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Video Frame Selector */}
          {videoUrl && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                src={videoUrl}
                className="max-w-[300px] hidden rounded-lg bg-black"
                crossOrigin="anonymous"
                muted
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setVideoDuration(videoRef.current.duration);
                    setCurrentTime(0);
                    captureFrame();
                  }
                }}
              />
              <canvas ref={canvasRef} className="hidden" />

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Use this bar to select your cover frame</span>
                </div>
                <Slider
                  value={[currentTime]}
                  onValueChange={handleSliderChange}
                  max={videoDuration}
                  step={0.1}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground text-center">
                  {currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setCapturedFrame(null);
              setCurrentTime(0);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSetCover} disabled={!capturedFrame}>
            Set as Cover
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
