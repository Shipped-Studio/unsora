"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { useTikTokCreatorInfo } from "@/hooks/use-tiktok-creator-info";
import { usePinterestBoards } from "@/hooks/use-connected-accounts";
import type { Composer } from "@/hooks/use-composer";
import {
  DEFAULT_GOOGLE_BUSINESS,
  DEFAULT_PINTEREST,
  DEFAULT_YOUTUBE,
  GOOGLE_BUSINESS_CTA_LABELS,
  defaultTikTok,
  type GoogleBusinessCta,
  type GoogleBusinessOptions,
  type TikTokLimits,
  type TikTokOptions,
  type YouTubeOptions,
} from "@/lib/scheduler/composer-state";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import {
  PRIVACY_LABELS,
  SELF_ONLY,
  TIKTOK_BRANDED_CONTENT_POLICY_URL,
  TIKTOK_MUSIC_USAGE_URL,
} from "@/lib/tiktok-post-settings";

const YOUTUBE_CATEGORIES: [string, string][] = [
  ["22", "People & Blogs"],
  ["1", "Film & Animation"],
  ["2", "Autos & Vehicles"],
  ["10", "Music"],
  ["15", "Pets & Animals"],
  ["17", "Sports"],
  ["19", "Travel & Events"],
  ["20", "Gaming"],
  ["23", "Comedy"],
  ["24", "Entertainment"],
  ["25", "News & Politics"],
  ["26", "Howto & Style"],
  ["27", "Education"],
  ["28", "Science & Technology"],
  ["29", "Nonprofits & Activism"],
];

function OptionsCard({
  account,
  children,
}: {
  account: ConnectedAccount;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <AccountAvatar account={account} size="sm" />
        <span className="truncate text-sm font-medium">{accountLabel(account)}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function YouTubeOptionsForm({
  account,
  composer,
}: {
  account: ConnectedAccount;
  composer: Composer;
}) {
  const { state, update } = composer;
  const options = state.youtube[account.id] ?? DEFAULT_YOUTUBE;
  const title = state.titles[account.id] ?? "";
  const set = (patch: Partial<YouTubeOptions>) =>
    update((prev) => ({
      ...prev,
      youtube: { ...prev.youtube, [account.id]: { ...options, ...patch } },
    }));

  return (
    <FieldGroup className="gap-4">
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor={`yt-title-${account.id}`}>Title</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">
            {title.length}/100
          </span>
        </div>
        <Input
          id={`yt-title-${account.id}`}
          value={title}
          maxLength={100}
          placeholder="What's this video about?"
          aria-invalid={!title.trim() || undefined}
          onChange={(event) =>
            update((prev) => ({
              ...prev,
              titles: { ...prev.titles, [account.id]: event.target.value },
            }))
          }
        />
        <FieldDescription>The caption becomes the video description.</FieldDescription>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Visibility</FieldLabel>
          <Select
            value={options.privacyStatus}
            items={{ public: "Public", unlisted: "Unlisted", private: "Private" }}
            onValueChange={(value) =>
              value && set({ privacyStatus: value as YouTubeOptions["privacyStatus"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <Select
            value={options.categoryId}
            items={Object.fromEntries(YOUTUBE_CATEGORIES)}
            onValueChange={(value) => value && set({ categoryId: value as string })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YOUTUBE_CATEGORIES.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`yt-tags-${account.id}`}>Tags</FieldLabel>
        <Input
          id={`yt-tags-${account.id}`}
          placeholder="Comma separated"
          defaultValue={options.tags.join(", ")}
          onBlur={(event) =>
            set({
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 30),
            })
          }
        />
      </Field>
      <Field orientation="horizontal">
        <Switch
          id={`yt-kids-${account.id}`}
          checked={options.madeForKids}
          onCheckedChange={(checked) => set({ madeForKids: checked })}
        />
        <FieldLabel htmlFor={`yt-kids-${account.id}`} className="font-normal">
          Made for kids
        </FieldLabel>
      </Field>
    </FieldGroup>
  );
}

function TikTokOptionsForm({
  account,
  composer,
  videoSeconds,
  onLimits,
}: {
  account: ConnectedAccount;
  composer: Composer;
  videoSeconds?: number;
  onLimits: (accountId: string, limits: TikTokLimits) => void;
}) {
  const { state, update } = composer;
  const { data: info, isLoading, isError } = useTikTokCreatorInfo(account.id);
  const options = state.tiktok[account.id] ?? defaultTikTok();
  const isPhoto = state.format !== "video";

  useEffect(() => {
    if (!info) return;
    onLimits(account.id, {
      maxVideoSeconds: info.max_video_post_duration_sec || undefined,
      canPost: info.can_post,
      canPostReason: info.can_post_reason,
    });
  }, [account.id, info, onLimits]);

  const set = (patch: Partial<TikTokOptions>) =>
    update((prev) => ({
      ...prev,
      tiktok: { ...prev.tiktok, [account.id]: { ...options, ...patch } },
    }));

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }
  if (isError || !info) {
    return (
      <Alert variant="destructive">
        <WarningCircle />
        <AlertDescription>
          We couldn&apos;t reach TikTok for this account. Reconnect it on the Accounts
          page, then come back.
        </AlertDescription>
      </Alert>
    );
  }

  const tooLong =
    !isPhoto &&
    info.max_video_post_duration_sec > 0 &&
    (videoSeconds ?? 0) > info.max_video_post_duration_sec;
  const disclosureIncomplete =
    options.commercialDisclosure && !options.yourBrand && !options.brandedContent;

  return (
    <FieldGroup className="gap-5">
      <p className="text-sm text-muted-foreground">
        Posting as{" "}
        <span className="font-medium text-foreground">
          {info.creator_nickname || accountLabel(account)}
        </span>
      </p>

      {!info.can_post ? (
        <Alert variant="destructive">
          <WarningCircle />
          <AlertDescription>
            {info.can_post_reason ||
              "TikTok isn't accepting posts from this account right now. Try again later."}
          </AlertDescription>
        </Alert>
      ) : null}
      {tooLong ? (
        <Alert variant="destructive">
          <WarningCircle />
          <AlertDescription>
            This account can post videos up to {info.max_video_post_duration_sec} seconds.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field>
        <FieldLabel>Who can see this post</FieldLabel>
        <Select
          value={options.privacyLevel || null}
          items={Object.fromEntries(
            info.privacy_level_options.map((option) => [option, PRIVACY_LABELS[option] ?? option]),
          )}
          onValueChange={(value) => value && set({ privacyLevel: value as string })}
        >
          <SelectTrigger className="w-full" aria-invalid={!options.privacyLevel || undefined}>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {info.privacy_level_options.map((option) => {
              const blocked = options.brandedContent && option === SELF_ONLY;
              return (
                <SelectItem key={option} value={option} disabled={blocked}>
                  {PRIVACY_LABELS[option] ?? option}
                  {blocked ? " (not allowed for branded content)" : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Allow people to</FieldLabel>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(
            [
              ["allowComment", "Comment", info.comment_disabled],
              ...(isPhoto
                ? []
                : ([
                    ["allowDuet", "Duet", info.duet_disabled],
                    ["allowStitch", "Stitch", info.stitch_disabled],
                  ] as const)),
            ] as const
          ).map(([key, label, disabled]) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm has-disabled:opacity-50"
            >
              <Checkbox
                checked={options[key]}
                disabled={disabled}
                onCheckedChange={(checked) => set({ [key]: checked === true })}
              />
              {label}
            </label>
          ))}
        </div>
      </Field>

      {isPhoto ? (
        <Field orientation="horizontal">
          <Switch
            id={`tt-music-${account.id}`}
            checked={options.autoAddMusic}
            onCheckedChange={(checked) => set({ autoAddMusic: checked })}
          />
          <FieldLabel htmlFor={`tt-music-${account.id}`} className="font-normal">
            Add recommended music
          </FieldLabel>
        </Field>
      ) : null}

      <Field orientation="horizontal">
        <Switch
          id={`tt-aigc-${account.id}`}
          checked={options.aigc}
          onCheckedChange={(checked) => set({ aigc: checked })}
        />
        <div className="space-y-0.5">
          <FieldLabel htmlFor={`tt-aigc-${account.id}`} className="font-normal">
            Label as AI-generated
          </FieldLabel>
          <FieldDescription>Turn on if AI created or heavily edited this.</FieldDescription>
        </div>
      </Field>

      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <Field orientation="horizontal">
          <Switch
            id={`tt-disclose-${account.id}`}
            checked={options.commercialDisclosure}
            onCheckedChange={(checked) =>
              set(
                checked
                  ? { commercialDisclosure: true }
                  : { commercialDisclosure: false, yourBrand: false, brandedContent: false },
              )
            }
          />
          <div className="space-y-0.5">
            <FieldLabel htmlFor={`tt-disclose-${account.id}`} className="font-normal">
              This promotes a brand, product or service
            </FieldLabel>
            <FieldDescription>TikTok requires this disclosure.</FieldDescription>
          </div>
        </Field>
        {options.commercialDisclosure ? (
          <div className="space-y-2.5 pl-11">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={options.yourBrand}
                onCheckedChange={(checked) => set({ yourBrand: checked === true })}
              />
              <span>
                Your brand
                <span className="block text-xs text-muted-foreground">
                  Labeled as promotional content.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={options.brandedContent}
                onCheckedChange={(checked) =>
                  set({
                    brandedContent: checked === true,
                    ...(checked === true && options.privacyLevel === SELF_ONLY
                      ? { privacyLevel: "" }
                      : {}),
                  })
                }
              />
              <span>
                Branded content
                <span className="block text-xs text-muted-foreground">
                  For another brand. Labeled as a paid partnership.
                </span>
              </span>
            </label>
            {disclosureIncomplete ? (
              <p className="text-xs text-destructive">Pick at least one.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        By posting, you agree to TikTok&apos;s{" "}
        {options.brandedContent ? (
          <>
            <a
              href={TIKTOK_BRANDED_CONTENT_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
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
          className="underline underline-offset-2 hover:text-foreground"
        >
          Music Usage Confirmation
        </a>
        .
      </p>
    </FieldGroup>
  );
}

function PinterestOptionsForm({
  account,
  composer,
}: {
  account: ConnectedAccount;
  composer: Composer;
}) {
  const { state, update } = composer;
  const options = state.pinterest[account.id] ?? DEFAULT_PINTEREST;
  const { data: boards, isLoading, isError } = usePinterestBoards(account.id);
  const set = (patch: Partial<typeof options>) =>
    update((prev) => ({
      ...prev,
      pinterest: { ...prev.pinterest, [account.id]: { ...options, ...patch } },
    }));

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>Board</FieldLabel>
        {isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t load boards. The pin goes to your first board.
          </p>
        ) : (
          <Select
            value={options.boardId ?? boards?.[0]?.id ?? null}
            items={Object.fromEntries((boards ?? []).map((board) => [board.id, board.name]))}
            onValueChange={(value) => value && set({ boardId: value as string })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a board" />
            </SelectTrigger>
            <SelectContent>
              {(boards ?? []).map((board) => (
                <SelectItem key={board.id} value={board.id}>
                  {board.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor={`pin-title-${account.id}`}>Pin title</FieldLabel>
        <Input
          id={`pin-title-${account.id}`}
          value={options.title}
          maxLength={100}
          placeholder="Optional"
          onChange={(event) => set({ title: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`pin-link-${account.id}`}>Destination link</FieldLabel>
        <Input
          id={`pin-link-${account.id}`}
          type="url"
          inputMode="url"
          value={options.link}
          placeholder="https://"
          onChange={(event) => set({ link: event.target.value })}
        />
      </Field>
    </FieldGroup>
  );
}

const NO_BUTTON = "NONE";

function GoogleBusinessOptionsForm({
  account,
  composer,
}: {
  account: ConnectedAccount;
  composer: Composer;
}) {
  const { state, update } = composer;
  const options = state.googleBusiness[account.id] ?? DEFAULT_GOOGLE_BUSINESS;
  const set = (patch: Partial<GoogleBusinessOptions>) =>
    update((prev) => ({
      ...prev,
      googleBusiness: { ...prev.googleBusiness, [account.id]: { ...options, ...patch } },
    }));
  const needsLink = Boolean(options.ctaType && options.ctaType !== "CALL");

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>Button</FieldLabel>
        <Select
          value={options.ctaType ?? NO_BUTTON}
          items={{ [NO_BUTTON]: "No button", ...GOOGLE_BUSINESS_CTA_LABELS }}
          onValueChange={(value) =>
            value &&
            set({ ctaType: value === NO_BUTTON ? undefined : (value as GoogleBusinessCta) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BUTTON}>No button</SelectItem>
            {Object.entries(GOOGLE_BUSINESS_CTA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {options.ctaType === "CALL" ? (
          <FieldDescription>Calls the phone number on your Business Profile.</FieldDescription>
        ) : null}
      </Field>
      {needsLink ? (
        <Field>
          <FieldLabel htmlFor={`gbp-link-${account.id}`}>Button link</FieldLabel>
          <Input
            id={`gbp-link-${account.id}`}
            type="url"
            inputMode="url"
            value={options.ctaUrl}
            placeholder="https://"
            aria-invalid={!/^https?:\/\/\S+$/i.test(options.ctaUrl.trim()) || undefined}
            onChange={(event) => set({ ctaUrl: event.target.value })}
          />
        </Field>
      ) : null}
    </FieldGroup>
  );
}

/** Settings for the selected accounts whose platforms have options. */
export function PlatformOptions({
  composer,
  selectedAccounts,
  locked,
  onTikTokLimits,
}: {
  composer: Composer;
  selectedAccounts: ConnectedAccount[];
  locked: string[];
  onTikTokLimits: (accountId: string, limits: TikTokLimits) => void;
}) {
  const withOptions = selectedAccounts.filter(
    (a) =>
      !locked.includes(a.id) &&
      (a.provider === "google" ||
        a.provider === "tiktok" ||
        a.provider === "pinterest" ||
        a.provider === "google_business"),
  );
  if (!withOptions.length) return null;
  const video = composer.state.media.find((m) => m.kind === "video");

  return (
    <div className="space-y-3">
      {withOptions.map((account) => (
        <OptionsCard key={account.id} account={account}>
          {account.provider === "google" ? (
            <YouTubeOptionsForm account={account} composer={composer} />
          ) : account.provider === "tiktok" ? (
            <TikTokOptionsForm
              account={account}
              composer={composer}
              videoSeconds={video?.duration}
              onLimits={onTikTokLimits}
            />
          ) : account.provider === "pinterest" ? (
            <PinterestOptionsForm account={account} composer={composer} />
          ) : (
            <GoogleBusinessOptionsForm account={account} composer={composer} />
          )}
        </OptionsCard>
      ))}
    </div>
  );
}
