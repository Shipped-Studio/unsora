"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Warning as AlertTriangle } from "@phosphor-icons/react";
import { ThreadsIcon } from "@/components/icons";

interface ThreadsConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

export function ThreadsConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: ThreadsConnectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <ThreadsIcon className="size-10" />
          </div>
          <DialogTitle className="text-2xl font-semibold text-center">
            Connect Threads
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Connect a Threads profile to publish text, images, and videos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Before connecting:</h3>

          <div className="flex gap-3 items-start">
            <AlertTriangle className="size-4 mt-0.5" />
            <p className="text-sm">
              Make sure you are signed in to the Threads profile you wish to
              connect. You may need to sign out and sign in to the correct
              account before proceeding.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button onClick={onConnect} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
