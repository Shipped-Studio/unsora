"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Warning as AlertTriangle } from "@phosphor-icons/react";
import { TikTokIcon } from "@/components/icons";
import { useTikTokCreatorInfo } from "@/hooks/use-tiktok-creator-info";
import {
  PRIVACY_LABELS,
  SELF_ONLY,
  TIKTOK_BRANDED_CONTENT_POLICY_URL,
  TIKTOK_MUSIC_USAGE_URL,
  defaultTikTokOptionsState,
  isTikTokOptionsValid,
  type TikTokOptionsState,
} from "@/lib/tiktok-post-settings";

interface TikTokPostOptionsProps {
  accountId: string;
  /** Fallback display name when creator info is still loading. */
  fallbackName: string;
  /** Selected video duration in seconds (0 when unknown). */
  videoDurationSec?: number;
  value: TikTokOptionsState | undefined;
  onChange: (accountId: string, next: TikTokOptionsState) => void;
  onValidityChange?: (accountId: string, valid: boolean) => void;
}

export function TikTokPostOptions({
  accountId,
  fallbackName,
  videoDurationSec = 0,
  value,
  onChange,
  onValidityChange,
}: TikTokPostOptionsProps) {
  const { data: info, isLoading, isError } = useTikTokCreatorInfo(accountId);

  const state = value ?? defaultTikTokOptionsState();

  const durationExceeded =
    !!info &&
    info.max_video_post_duration_sec > 0 &&
    videoDurationSec > info.max_video_post_duration_sec;

  // Report posting validity to the parent so it can gate the publish button.
  useEffect(() => {
    if (!onValidityChange) return;
    const valid =
      !!info &&
      info.can_post &&
      !durationExceeded &&
      isTikTokOptionsValid(state);
    onValidityChange(accountId, valid);
    // We intentionally depend on the derived inputs, not the callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accountId,
    info,
    durationExceeded,
    state.privacyLevel,
    state.commercialDisclosure,
    state.yourBrand,
    state.brandedContent,
  ]);

  const update = (patch: Partial<TikTokOptionsState>) => {
    onChange(accountId, { ...state, ...patch });
  };

  if (isLoading) {
    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  if (isError || !info) {
    return (
      <Card className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load TikTok settings</AlertTitle>
          <AlertDescription>
            We couldn&apos;t reach TikTok for this account. Try reconnecting it,
            then reload this page.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  const displayName = info.creator_nickname || fallbackName;
  const privacyOptions = info.privacy_level_options ?? [];

  // Branded content cannot be private — selecting it clears a SELF_ONLY choice.
  const handleBrandedContentChange = (checked: boolean) => {
    const patch: Partial<TikTokOptionsState> = { brandedContent: checked };
    if (checked && state.privacyLevel === SELF_ONLY) {
      patch.privacyLevel = "";
    }
    update(patch);
  };

  const handleDisclosureToggle = (checked: boolean) => {
    update(
      checked
        ? { commercialDisclosure: true }
        : { commercialDisclosure: false, yourBrand: false, brandedContent: false },
    );
  };

  const disclosureMissingSelection =
    state.commercialDisclosure && !state.yourBrand && !state.brandedContent;

  return (
    <Card className="p-4 space-y-4">
      {/* Creator identity */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={info.creator_avatar_url || undefined} alt={displayName} />
          <AvatarFallback>
            <TikTokIcon className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <Badge variant="secondary" className="text-xs">
              TikTok
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            This content will be posted to this TikTok account
          </p>
        </div>
      </div>

      {!info.can_post && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Posting unavailable</AlertTitle>
          <AlertDescription>
            {info.can_post_reason ||
              "This account can't post to TikTok right now. Please try again later."}
          </AlertDescription>
        </Alert>
      )}

      {durationExceeded && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Video too long for TikTok</AlertTitle>
          <AlertDescription>
            This account can post videos up to{" "}
            {info.max_video_post_duration_sec}s. Trim the video to continue.
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Privacy level — required, no default */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          Who can view this video{" "}
          <span className="text-destructive font-normal">*</span>
        </Label>
        <Select
          value={state.privacyLevel || undefined}
          onValueChange={(v) => v && update({ privacyLevel: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select who can view this video" />
          </SelectTrigger>
          <SelectContent>
            {privacyOptions.map((option) => {
              const brandedBlocked =
                state.brandedContent && option === SELF_ONLY;
              return (
                <SelectItem
                  key={option}
                  value={option}
                  disabled={brandedBlocked}
                >
                  {PRIVACY_LABELS[option] ?? option}
                  {brandedBlocked
                    ? " — unavailable for branded content"
                    : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {!state.privacyLevel && (
          <p className="text-xs text-muted-foreground">
            Required — choose a privacy setting to post to TikTok.
          </p>
        )}
      </div>

      {/* Interaction settings */}
      <div className="space-y-2">
        <Label className="text-sm">Allow users to</Label>
        <div className="flex flex-col gap-2.5">
          <InteractionToggle
            label="Comment"
            checked={state.allowComment}
            disabled={info.comment_disabled}
            onChange={(c) => update({ allowComment: c })}
          />
          <InteractionToggle
            label="Duet"
            checked={state.allowDuet}
            disabled={info.duet_disabled}
            onChange={(c) => update({ allowDuet: c })}
          />
          <InteractionToggle
            label="Stitch"
            checked={state.allowStitch}
            disabled={info.stitch_disabled}
            onChange={(c) => update({ allowStitch: c })}
          />
        </div>
      </div>

      <Separator />

      {/* Commercial content disclosure */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Disclose video content</Label>
            <p className="text-xs text-muted-foreground">
              Turn on to declare that this content promotes yourself, a brand,
              product, or service.
            </p>
          </div>
          <Switch
            checked={state.commercialDisclosure}
            onCheckedChange={handleDisclosureToggle}
          />
        </div>

        {state.commercialDisclosure && (
          <div className="space-y-2.5 rounded-md border bg-muted/40 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={state.yourBrand}
                onCheckedChange={(c) => update({ yourBrand: c === true })}
              />
              <span className="text-sm">
                Your brand
                <span className="block text-xs text-muted-foreground">
                  You are promoting yourself or your own business. Your video
                  will be labeled as <strong>Promotional content</strong>.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={state.brandedContent}
                onCheckedChange={(c) => handleBrandedContentChange(c === true)}
              />
              <span className="text-sm">
                Branded content
                <span className="block text-xs text-muted-foreground">
                  You are promoting another brand or a third party. Your video
                  will be labeled as <strong>Paid partnership</strong>.
                </span>
              </span>
            </label>

            {disclosureMissingSelection && (
              <p className="text-xs text-destructive">
                You need to indicate if your content promotes yourself, a third
                party, or both.
              </p>
            )}
          </div>
        )}
      </div>

      {/* AI-generated content */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm">AI-generated content</Label>
          <p className="text-xs text-muted-foreground">
            Turn on if this content was created or significantly edited with AI.
          </p>
        </div>
        <Switch
          checked={state.aigc}
          onCheckedChange={(c) => update({ aigc: c })}
        />
      </div>

      <Separator />

      {/* Consent declaration */}
      <p className="text-xs text-muted-foreground">
        By posting, you agree to TikTok&apos;s{" "}
        {state.brandedContent || state.yourBrand ? (
          <>
            <a
              href={TIKTOK_BRANDED_CONTENT_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Branded Content Policy
            </a>{" "}
            and{" "}
          </>
        ) : null}
        <a
          href={TIKTOK_MUSIC_USAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Music Usage Confirmation
        </a>
        .
      </p>
    </Card>
  );
}

function InteractionToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const row = (
    <label
      className={`flex items-center gap-2.5 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <Checkbox
        checked={disabled ? false : checked}
        disabled={disabled}
        onCheckedChange={(c) => !disabled && onChange(c === true)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );

  if (!disabled) return row;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex w-fit" />}>
        {row}
      </TooltipTrigger>
      <TooltipContent>
        Turned off in this creator&apos;s TikTok privacy settings
      </TooltipContent>
    </Tooltip>
  );
}
