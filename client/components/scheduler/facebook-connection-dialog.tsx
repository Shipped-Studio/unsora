"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle as CheckCircle2, Info } from "@phosphor-icons/react";
import { FacebookIcon } from "@/components/icons";

interface FacebookConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

export function FacebookConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: FacebookConnectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <FacebookIcon className="size-10" />
          </div>
          <DialogTitle className="text-2xl font-semibold text-center">
            Connect Facebook Page
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="size-4 mt-0.5" />
            <p className="text-sm">Must be a Page</p>
          </div>

          <div className="flex gap-3 items-start">
            <Info className="size-4 mt-0.5" />
            <p className="text-sm">
              Unsora AI only supports connecting Facebook Pages. Personal
              profiles and Groups are not supported.
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
              {isConnecting ? "Connecting..." : "Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
