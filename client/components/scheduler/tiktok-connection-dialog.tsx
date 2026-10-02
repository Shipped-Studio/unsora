"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Warning as AlertTriangle, CaretDown as ChevronDown } from "@phosphor-icons/react";
import { useState } from "react";
import { TikTokIcon } from "@/components/icons";

interface TikTokConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

export function TikTokConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: TikTokConnectionDialogProps) {
  const [loginSectionOpen, setLoginSectionOpen] = useState(false);
  const [warmupSectionOpen, setWarmupSectionOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <TikTokIcon className="h-10 w-10" />
          </div>
          <DialogTitle className="text-2xl font-semibold text-center">
            Connect TikTok
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Connect a TikTok Creator or Business profile to schedule posts,
            manage comments and more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Requirements:
            </h3>
            <div className="space-y-2">
              <div className="flex gap-3">
                <AlertTriangle className="size-4 mt-0.5" />
                <p className="text-sm">
                  Must be a Business or Creator profile
                </p>
              </div>
              <div className="flex gap-3">
                <AlertTriangle className="size-4 mt-0.5" />
                <p className="text-sm">
                  Account must be older than 48 hours
                </p>
              </div>
            </div>
          </div>

          <Collapsible
            open={loginSectionOpen}
            onOpenChange={setLoginSectionOpen}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left py-2 hover:text-primary transition-colors">
              <span className="text-sm font-medium">
                Login to the account you want to connect
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  loginSectionOpen ? "transform rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pb-2">
              <div className="text-sm text-muted-foreground space-y-2 pl-4 border-l-2 border-muted">
                <p>
                  Before clicking "Connect", make sure you're logged into the
                  TikTok account you want to connect in your browser.
                </p>
                <p>
                  If you need to switch accounts, log out of your current TikTok
                  account and log in with the one you want to connect.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={warmupSectionOpen}
            onOpenChange={setWarmupSectionOpen}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left py-2 hover:text-primary transition-colors">
              <span className="text-sm font-medium">
                Warm up account before posting
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  warmupSectionOpen ? "transform rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pb-2">
              <div className="text-sm text-muted-foreground space-y-2 pl-4 border-l-2 border-muted">
                <p>
                  For new TikTok accounts or accounts with low activity, we
                  recommend "warming up" your account before scheduling posts.
                </p>
                <p>
                  This means manually posting content, engaging with other
                  users, and building up your account's reputation over several
                  days before using automated posting.
                </p>
                <p>
                  This helps avoid triggering TikTok's spam detection and
                  ensures better performance for your scheduled posts.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
