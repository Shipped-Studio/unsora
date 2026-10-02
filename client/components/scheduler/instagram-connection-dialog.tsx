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
import { Warning as AlertTriangle } from "@phosphor-icons/react";
import { InstagramIcon } from "@/components/icons";

interface InstagramConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

export function InstagramConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: InstagramConnectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <InstagramIcon className="h-10 w-10" />
          </div>
          <DialogTitle className="text-2xl font-semibold text-center">
            Connect Instagram
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Connect to an Instagram account to schedule and publish posts.
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
                Instagram Business or Creator account is required
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              You can revoke our access to your data at any time through your{" "}
              <a
                href="https://www.instagram.com/accounts/manage_access/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Instagram security settings
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
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
