"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Warning as AlertTriangle, CheckCircle as CheckCircle2 } from "@phosphor-icons/react";
import { YouTubeIcon } from "@/components/icons";

interface YouTubeConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

export function YouTubeConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: YouTubeConnectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <YouTubeIcon className="size-10" />
          </div>
          <DialogTitle className="text-2xl font-semibold text-center">
            Connect YouTube
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Connect to a YouTube account to upload and schedule YouTube Shorts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Requirements:
            </h3>
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Google account must be associated with a YouTube channel
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              Required Permissions:
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 mt-0.5" />
                <span>View your YouTube channel information</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 mt-0.5" />
                <span>Upload videos to your YouTube channel</span>
              </li>
            </ul>
            <p className="text-sm mt-3 font-medium text-muted-foreground">
              Please grant all permissions on the next screen to enable video
              uploads.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              You can revoke our access to your data at any time through the{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Google security settings page
              </a>
              .
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button onClick={onConnect} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Continue to Google"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
