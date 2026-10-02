"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ConnectedAccount } from "@/hooks/use-connected-accounts";
import { getPlatformIcon, formatHandle } from "@/lib/platform-utils";

interface AccountCaptionsProps {
  selectedAccounts: ConnectedAccount[];
  accountCaptions: Record<string, string>;
  onCaptionChange: (accountId: string, caption: string) => void;
  mainCaption: string;
}

export function AccountCaptions({
  selectedAccounts,
  accountCaptions,
  onCaptionChange,
  mainCaption,
}: AccountCaptionsProps) {
  const getPlatformName = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "google":
        return "YouTube";
      case "facebook":
        return "Facebook";
      case "instagram":
        return "Instagram";
      case "tiktok":
        return "TikTok";
      case "bluesky":
        return "Bluesky";
      case "threads":
        return "Threads";
      case "pinterest":
        return "Pinterest";
      case "linkedin":
        return "LinkedIn";
      default:
        return provider;
    }
  };

  const maxCaptionLength = 2200;

  if (selectedAccounts.length === 0) {
    return (
      <Card className="p-6 bg-muted/50 border-dashed">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Select accounts to customize captions
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {selectedAccounts.map((account) => {
        const platformName = getPlatformName(account.provider);
        const displayName =
          account.accountName ||
          account.accountUsername ||
          `${platformName} Account`;
        const currentCaption = accountCaptions[account.id] || mainCaption;

        return (
          <Card key={account.id} className="p-4">
            <div className="space-y-3">
              {/* Account Header */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={account.profilePicture || undefined}
                    alt={displayName}
                  />
                  <AvatarFallback>
                    {getPlatformIcon(account.provider, {
                      className: "h-4 w-4",
                    })}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">{displayName}</Label>
                    <Badge variant="secondary" className="text-xs">
                      {platformName}
                    </Badge>
                  </div>
                  {account.accountUsername && (
                    <p className="text-xs text-muted-foreground">
                      {formatHandle(account.accountUsername)}
                    </p>
                  )}
                </div>
              </div>

              {/* Caption Input */}
              <div className="space-y-2">
                <Textarea
                  placeholder={
                    mainCaption
                      ? "Leave empty to use main caption..."
                      : "Write a custom caption for this account..."
                  }
                  value={accountCaptions[account.id] || ""}
                  onChange={(e) => onCaptionChange(account.id, e.target.value)}
                  maxLength={maxCaptionLength}
                  className="min-h-[120px] resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {account.provider.toLowerCase() === "google" ? (
                      "Used as the video description unless one is set in YouTube details"
                    ) : accountCaptions[account.id] ? (
                      "Using custom caption"
                    ) : (
                      <span className="italic">Using main caption</span>
                    )}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {currentCaption.length}/{maxCaptionLength}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
