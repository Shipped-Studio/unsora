"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarBlank,
  CaretDown,
  CheckCircle,
  Circle,
  PaperPlaneTilt,
  Queue,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryPickerDialog } from "@/components/files/library-picker-dialog";
import { AccountAvatar } from "@/components/scheduler/account-avatar";
import { PublishNowDialog } from "@/components/scheduler/publish-now-dialog";
import { AccountPicker } from "./account-picker";
import { CaptionEditor } from "./caption-editor";
import { ComposerSection } from "./composer-section";
import { PhotoEditor, SlideshowEditor } from "./media/image-editors";
import { VideoEditor } from "./media/video-editor";
import { PlatformOptions } from "./platform-options";
import { PreviewPanel } from "./post-preview";
import { SchedulePicker } from "./schedule-picker";
import { ApiError } from "@/hooks/use-api";
import { useComposer } from "@/hooks/use-composer";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import {
  useCreatePost,
  usePublishNow,
  usePublishPost,
  useUpdatePost,
} from "@/hooks/use-posts";
import { useNextSlots, useSchedulerTimezone } from "@/hooks/use-schedule";
import type { Issue, TikTokLimits } from "@/lib/scheduler/composer-state";
import { formatDayTime, zoneLabel } from "@/lib/scheduler/dates";
import {
  FORMATS,
  FORMAT_ORDER,
  PLATFORMS,
  isProvider,
  type PostFormat,
} from "@/lib/scheduler/formats";
import type { ConnectedAccount, Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

type Intent = "draft" | "schedule" | "queue" | "now";

const SECTION_FOR: Record<Issue["field"], string> = {
  accounts: "composer-accounts",
  media: "composer-media",
  caption: "composer-caption",
  options: "composer-options",
  schedule: "composer-accounts",
};

/** Scrolls a composer section into view, without animation for reduced motion. */
function scrollToSection(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function Checklist({
  issues,
  accounts,
  attempted,
}: {
  issues: Issue[];
  accounts: ConnectedAccount[];
  /** After a submit attempt the list reads as problems; before, as a to-do list. */
  attempted: boolean;
}) {
  const errors = issues.filter((issue) => issue.level === "error");
  if (!errors.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
        <CheckCircle weight="fill" className="size-4 text-success" />
        Ready to schedule
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">
        {!attempted
          ? "Before you post"
          : errors.length === 1
            ? "1 thing to fix"
            : `${errors.length} things to fix`}
      </p>
      <ul className="divide-y divide-border">
        {errors.map((issue, index) => {
          const account = accounts.find((a) => a.id === issue.accountId);
          return (
            <li key={`${issue.message}-${index}`}>
              <button
                type="button"
                onClick={() => scrollToSection(SECTION_FOR[issue.field])}
                className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                {account ? (
                  <AccountAvatar account={account} size="xs" className="mt-0.5" />
                ) : attempted ? (
                  <WarningCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">{issue.message}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Composer({
  initialFormat,
  post,
}: {
  initialFormat: PostFormat;
  post?: Post;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountsQuery = useConnectedAccounts();
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const defaultTimezone = useSchedulerTimezone();

  const composer = useComposer({
    format: initialFormat,
    timezone: defaultTimezone,
    post,
    accounts,
  });
  const { state, update } = composer;

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [pending, setPending] = useState<Intent | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [confirmNow, setConfirmNow] = useState(false);
  const [tiktokLimits, setTikTokLimits] = useState<Record<string, TikTokLimits>>({});
  const onTikTokLimits = useCallback(
    (accountId: string, limits: TikTokLimits) =>
      setTikTokLimits((prev) => ({ ...prev, [accountId]: limits })),
    [],
  );

  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const publishNow = usePublishNow();
  const publishPost = usePublishPost();
  const nextSlots = useNextSlots({
    timezone: state.timezone,
    count: 1,
    excludePostId: post?.id,
  });
  const nextSlot = nextSlots.data?.slots[0] ?? null;

  const locked = useMemo(
    () => post?.postAccounts.filter((leg) => leg.published).map((leg) => leg.accountId) ?? [],
    [post],
  );
  const selectedAccounts = useMemo(
    () =>
      state.accountIds
        .map((id) => accounts.find((a) => a.id === id))
        .filter((a): a is ConnectedAccount => Boolean(a)),
    [accounts, state.accountIds],
  );

  // Links from the Library, tools and the calendar prefill the composer.
  const prefilled = useRef(false);
  useEffect(() => {
    if (post || prefilled.current) return;
    prefilled.current = true;
    const media = searchParams.get("media");
    if (media && initialFormat !== "text") {
      void composer.addRemote([
        { url: media, kind: initialFormat === "video" ? "video" : "image" },
      ]);
    }
    const date = searchParams.get("date");
    if (date) {
      const at = new Date(date);
      if (!Number.isNaN(at.getTime()) && at.getTime() > Date.now() + 60_000) {
        update((prev) => ({ ...prev, scheduledAt: at }), false);
      }
    }
    const account = searchParams.get("account");
    if (account) {
      update((prev) => ({ ...prev, accountIds: [account] }), false);
    }
    // Run once on mount with the initial params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!composer.dirty || pending) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [composer.dirty, pending]);

  const publishIssues = composer.issuesFor("publish", {
    tiktokLimits,
    lockedAccountIds: locked,
  });
  const draftIssues = composer.issuesFor("draft", { lockedAccountIds: locked });
  const blocking = publishIssues.filter((issue) => issue.level === "error");

  const showCover = selectedAccounts.some(
    (a) => isProvider(a.provider) && (PLATFORMS[a.provider].videoCover || a.provider === "tiktok"),
  );

  const [confirmFormat, setConfirmFormat] = useState<PostFormat | null>(null);

  const applyFormat = (next: PostFormat) => {
    composer.setFormat(next);
    const query = searchParams.toString();
    window.history.replaceState(null, "", `${FORMATS[next].href}${query ? `?${query}` : ""}`);
  };

  const switchFormat = (next: PostFormat) => {
    if (next === state.format) return;
    const dropping = state.media.some((m) =>
      next === "video" ? m.kind === "image" : next === "text" || m.kind === "video",
    );
    if (dropping) setConfirmFormat(next);
    else applyFormat(next);
  };

  const submit = async (intent: Intent) => {
    const issues = intent === "draft" ? draftIssues : publishIssues;
    const firstError = issues.find((issue) => issue.level === "error");
    if (firstError) {
      setAttempted(true);
      toast.error(firstError.message);
      scrollToSection(SECTION_FOR[firstError.field]);
      return;
    }

    let scheduledAt: Date | null = null;
    if (intent === "schedule") {
      scheduledAt = state.scheduledAt;
      if (!scheduledAt) {
        setWhenOpen(true);
        return;
      }
      if (scheduledAt.getTime() < Date.now() + 60_000) {
        toast.error("That time has passed. Pick a later time.");
        setWhenOpen(true);
        return;
      }
    }
    if (intent === "queue") {
      const { data: fresh } = await nextSlots.refetch();
      const slot = fresh?.slots[0];
      if (!slot) {
        toast.error("Set your posting times on the Queue page first.", {
          action: { label: "Open Queue", onClick: () => router.push("/scheduler/queue") },
        });
        return;
      }
      scheduledAt = new Date(slot);
    }

    const payload = composer.payload;
    setPending(intent);
    try {
      let saved: Post;
      if (post) {
        if (intent === "now") {
          saved = await updatePost.mutateAsync({ id: post.id, ...payload });
          await publishPost.mutateAsync(post.id);
        } else {
          saved = await updatePost.mutateAsync({
            id: post.id,
            ...payload,
            scheduledFor: scheduledAt ? scheduledAt.toISOString() : null,
            timezone: scheduledAt ? state.timezone : null,
          });
        }
      } else if (intent === "now") {
        saved = await publishNow.mutateAsync(payload);
      } else {
        saved = await createPost.mutateAsync({
          ...payload,
          scheduledFor: scheduledAt ? scheduledAt.toISOString() : null,
          timezone: scheduledAt ? state.timezone : null,
        });
      }

      composer.setDirty(false);
      if (intent === "draft") toast.success("Draft saved");
      else if (intent === "now") {
        if (!post) toast.success("Publishing started");
      } else toast.success(`Scheduled for ${formatDayTime(scheduledAt!, state.timezone)}`);

      router.push(`/scheduler/posts/${saved.id}`);
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Couldn't save the post. Try again.",
      );
      setPending(null);
    }
  };

  const whenLabel = state.scheduledAt
    ? `${formatDayTime(state.scheduledAt, state.timezone)} ${zoneLabel(state.timezone, state.scheduledAt)}`
    : "Pick a date and time";

  const formatLabel = FORMATS[state.format].label.toLowerCase();

  return (
    // shrink-0 keeps the column as tall as its content, so the sticky dock
    // stays at the bottom of the form instead of overlapping it.
    <div className="flex min-h-svh shrink-0 flex-col">
      <PageHeader
        parents={[{ label: "Posts", href: "/scheduler/posts" }]}
        title={post ? "Edit post" : `New ${formatLabel} post`}
        description={null}
      />

      <div className="grid w-full flex-1 grid-cols-1 gap-8 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:px-8">
        <div className="min-w-0 space-y-8">
          {!post ? (
            <Tabs value={state.format} onValueChange={(value) => switchFormat(value as PostFormat)}>
              <TabsList>
                {FORMAT_ORDER.map((format) => (
                  <TabsTrigger key={format} value={format}>
                    {FORMATS[format].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}

          <ComposerSection
            id="composer-accounts"
            title="Post to"
            description={
              locked.length
                ? "Accounts this already went out to are locked."
                : `Accounts that can't take ${formatLabel} posts are greyed out.`
            }
          >
            <AccountPicker
              accounts={accounts}
              loading={accountsQuery.isLoading}
              format={state.format}
              selected={state.accountIds}
              locked={locked}
              onToggle={composer.toggleAccount}
              onSelectMany={(ids, auto) =>
                update((prev) => ({ ...prev, accountIds: ids }), !auto)
              }
            />
          </ComposerSection>

          {state.format !== "text" ? (
            <ComposerSection
              id="composer-media"
              title={
                state.format === "video"
                  ? "Video"
                  : state.format === "slideshow"
                    ? "Slides"
                    : "Images"
              }
            >
              {state.format === "video" ? (
                <VideoEditor
                  composer={composer}
                  onOpenLibrary={() => setLibraryOpen(true)}
                  showCover={showCover}
                />
              ) : state.format === "slideshow" ? (
                <SlideshowEditor
                  composer={composer}
                  selectedAccounts={selectedAccounts}
                  onOpenLibrary={() => setLibraryOpen(true)}
                />
              ) : (
                <PhotoEditor
                  composer={composer}
                  selectedAccounts={selectedAccounts}
                  onOpenLibrary={() => setLibraryOpen(true)}
                />
              )}
            </ComposerSection>
          ) : null}

          <ComposerSection
            id="composer-caption"
            title={state.format === "text" ? "Post" : "Caption"}
          >
            <CaptionEditor
              composer={composer}
              selectedAccounts={selectedAccounts}
              locked={locked}
            />
          </ComposerSection>

          <div id="composer-options" className="scroll-mt-20">
            {selectedAccounts.some((a) =>
              ["google", "tiktok", "pinterest", "google_business"].includes(a.provider),
            ) ? (
              <ComposerSection title="Platform settings">
                <PlatformOptions
                  composer={composer}
                  selectedAccounts={selectedAccounts}
                  locked={locked}
                  onTikTokLimits={onTikTokLimits}
                />
              </ComposerSection>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PreviewPanel state={state} selectedAccounts={selectedAccounts} />
          <Checklist issues={publishIssues} accounts={accounts} attempted={attempted} />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border bg-card">
        <div className="flex w-full items-center gap-2 px-4 py-3 md:px-6 lg:px-8">
          <Popover open={whenOpen} onOpenChange={setWhenOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-label={whenLabel}
                  className={cn(
                    "relative font-normal max-sm:w-9 max-sm:px-0 sm:mr-auto",
                    !state.scheduledAt && "text-muted-foreground",
                  )}
                />
              }
            >
              <CalendarBlank />
              <span className="hidden sm:inline">{whenLabel}</span>
              {state.scheduledAt ? (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary sm:hidden"
                />
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-auto p-3">
              <SchedulePicker
                value={state.scheduledAt}
                timezone={state.timezone}
                excludePostId={post?.id}
                onChange={(scheduledAt) => update((prev) => ({ ...prev, scheduledAt }))}
                onTimezoneChange={(timezone) => update((prev) => ({ ...prev, timezone }))}
              />
              {state.scheduledAt ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update((prev) => ({ ...prev, scheduledAt: null }))}
                  >
                    Clear time
                  </Button>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => void submit("draft")}
            className="flex-1 max-sm:px-3 sm:flex-none"
          >
            {pending === "draft" ? <Spinner /> : null}
            Save draft
          </Button>
          <ButtonGroup className="flex-1 sm:flex-none">
            <Button
              type="button"
              disabled={pending !== null}
              onClick={() =>
                void submit(state.scheduledAt ? "schedule" : nextSlot ? "queue" : "schedule")
              }
              className="flex-1 max-sm:px-3"
            >
              {pending && pending !== "draft" ? <Spinner /> : null}
              {state.scheduledAt ? "Schedule" : nextSlot ? "Add to queue" : "Schedule"}
            </Button>
            <ButtonGroupSeparator className="bg-primary-foreground/25" />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    aria-label="More publishing options"
                    disabled={pending !== null}
                  />
                }
              >
                <CaretDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-64">
                <DropdownMenuItem onClick={() => setWhenOpen(true)}>
                  <CalendarBlank />
                  Pick a date and time
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void submit("queue")}>
                  <Queue />
                  <span className="flex-1">Add to queue</span>
                  {nextSlot ? (
                    <span className="text-xs text-muted-foreground">
                      {formatDayTime(nextSlot, state.timezone)}
                    </span>
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => (blocking.length ? void submit("now") : setConfirmNow(true))}
                >
                  <PaperPlaneTilt />
                  Publish now
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
        {blocking.length && state.accountIds.length ? (
          <span className="sr-only" aria-live="polite">
            {blocking.length} issues to fix before scheduling
          </span>
        ) : null}
      </div>

      <PublishNowDialog
        open={confirmNow}
        onOpenChange={setConfirmNow}
        accounts={state.accountIds.length}
        onConfirm={() => void submit("now")}
      />

      <AlertDialog
        open={confirmFormat !== null}
        onOpenChange={(open) => !open && setConfirmFormat(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch to {confirmFormat ? FORMATS[confirmFormat].label.toLowerCase() : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The media you added doesn&apos;t fit this format and will be removed. Your
              caption and accounts stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmFormat) applyFormat(confirmFormat);
                setConfirmFormat(null);
              }}
            >
              Switch format
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LibraryPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        mediaType={state.format === "video" ? "video" : "image"}
        multiple={state.format !== "video"}
        max={35}
        onSelect={(items) => {
          const usable = items.filter((item) => item.url);
          if (!usable.length) return;
          void composer.addRemote(
            usable.map((item) => ({
              url: item.url!,
              kind: state.format === "video" ? "video" : "image",
              width: item.width,
              height: item.height,
              duration: item.duration,
              mimeType: item.mimeType,
              name: item.label,
            })),
            { replace: state.format === "video" },
          );
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}
