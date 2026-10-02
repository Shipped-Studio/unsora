"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { UploadArea } from "@/components/subtitle-editor/upload-area";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoUploaded: (url: string, file: File) => void;
  isCreating?: boolean;
}

export function UploadDialog({
  open,
  onOpenChange,
  onVideoUploaded,
  isCreating = false,
}: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Video</DialogTitle>
          <DialogDescription>
            Upload your video to generate and configure subtitles.
          </DialogDescription>
        </DialogHeader>

        {isCreating ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Setting up your project...
          </div>
        ) : (
          <UploadArea onVideoUploaded={onVideoUploaded} />
        )}
      </DialogContent>
    </Dialog>
  );
}
