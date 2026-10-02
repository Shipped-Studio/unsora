"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { BlueskyIcon } from "@/components/icons";

interface BlueskyConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (handle: string) => void;
  isConnecting: boolean;
}

export function BlueskyConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: BlueskyConnectionDialogProps) {
  const [handle, setHandle] = useState("");

  const trimmedHandle = handle.trim().replace(/^@/, "");
  const canSubmit = trimmedHandle.includes(".") && !isConnecting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConnect(trimmedHandle);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <BlueskyIcon className="h-10 w-10" />
          </div>
          <DialogTitle className="text-2xl font-semibold text-center">
            Connect Bluesky
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Enter your Bluesky handle to sign in securely with OAuth — no
            password is shared with Unsora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bluesky-handle">Bluesky handle</Label>
            <Input
              id="bluesky-handle"
              placeholder="alice.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Your full handle, including the domain — e.g. alice.bsky.social
              or a custom domain like alice.com. You&apos;ll be redirected to
              Bluesky to approve access.
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
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
