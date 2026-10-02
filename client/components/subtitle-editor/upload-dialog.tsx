"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/states";
import { UploadArea } from "@/components/subtitle-editor/upload-area";

/** Uploads a video and creates a subtitle project from it. */
export function UploadDialog({
  open,
  onOpenChange,
  onVideoUploaded,
  isCreating = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoUploaded: (url: string, file: File) => void;
  isCreating?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isCreating) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={!isCreating}>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Upload a video to transcribe and style its subtitles.
          </DialogDescription>
        </DialogHeader>
        {isCreating ? (
          <LoadingState
            label="Creating project"
            className="rounded-xl border border-dashed"
          />
        ) : (
          <UploadArea onVideoUploaded={onVideoUploaded} />
        )}
      </DialogContent>
    </Dialog>
  );
}
