"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  ArrowsDownUp,
  Copy,
  DotsThree,
  Eye,
  ListChecks,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Robot,
  Trash,
} from "@phosphor-icons/react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { AccountStack, accountLabel } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { PostStatusBadge } from "@/components/scheduler/post-status-badge";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { PublishNowDialog } from "@/components/scheduler/publish-now-dialog";
import { readableError } from "@/components/scheduler/readable-error";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useBulkDeletePosts,
  useDeletePost,
  useDuplicatePost,
  usePostCounts,
  usePosts,
  usePublishPost,
  useRetryPost,
  type PostFilters,
} from "@/hooks/use-posts";
import { useSchedulerTimezone } from "@/hooks/use-schedule";
import { formatDayTime } from "@/lib/scheduler/dates";
import { FORMATS, formatForPost, type PostType } from "@/lib/scheduler/formats";
import {
  STATUS_TABS,
  canDelete,
  canEdit,
  canPublishNow,
  canRetry,
} from "@/lib/scheduler/status";
import type { Post, PostStatus } from "@/lib/scheduler/types";


const PAGE_SIZE = 20;

const SORTS: Record<string, { label: string; sort: PostFilters["sort"]; dir: PostFilters["dir"] }> = {
  recent: { label: "Recently created", sort: "created", dir: "desc" },
  upcoming: { label: "Scheduled soonest", sort: "scheduled", dir: "asc" },
  published: { label: "Recently published", sort: "published", dir: "desc" },
  updated: { label: "Recently edited", sort: "updated", dir: "desc" },
};

const TYPE_FILTERS: { value: string; label: string; types?: PostType }[] = [
  { value: "all", label: "All formats" },
  { value: "VIDEO", label: "Video", types: "VIDEO" },
  { value: "CAROUSEL", label: "Carousel", types: "CAROUSEL" },
  { value: "IMAGE", label: "Single photo", types: "IMAGE" },
  { value: "TEXT", label: "Text", types: "TEXT" },
];

const EMPTY_COPY: Record<string, { title: string; description: string }> = {
  all: {
    title: "No posts yet",
    description: "Create a post, or ask your agent to schedule one through the Unsora MCP server.",
  },
  scheduled: {
    title: "Nothing scheduled",
    description: "Scheduled posts show up here until they go out.",
  },
  drafts: {
    title: "No drafts",
    description: "Save a post without a time and it waits here.",
  },
  published: {
    title: "Nothing published yet",
    description: "Posts appear here once they go out.",
  },
  failed: {
    title: "Nothing needs attention",
    description: "Posts that fail on one or more accounts show up here so you can retry them.",
  },
};

function whenFor(post: Post, zone: string) {
  if (post.publishedAt) return { label: "Published", at: formatDayTime(post.publishedAt, zone) };
  if (post.scheduledFor) return { label: "Scheduled", at: formatDayTime(post.scheduledFor, zone) };
  return { label: "Edited", at: formatDayTime(post.updatedAt, zone) };
}

function RowActions({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const publish = usePublishPost();
  const retry = useRetryPost();
  const duplicate = useDuplicatePost();
  const remove = useDeletePost();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Post actions" />}
        >
          <DotsThree weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onOpen}>
            <Eye />
            Quick view
          </DropdownMenuItem>
          {canEdit(post.status) ? (
            <DropdownMenuItem render={<Link href={`/scheduler/posts/${post.id}/edit`} />}>
              <PencilSimple />
              Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() =>
              duplicate.mutate(post.id, {
                onSuccess: (copy) => router.push(`/scheduler/posts/${copy.id}/edit`),
              })
            }
          >
            <Copy />
            Duplicate
          </DropdownMenuItem>
          {canPublishNow(post.status) ? (
            <DropdownMenuItem onClick={() => setConfirmPublish(true)}>
              <PaperPlaneTilt />
              Publish now
            </DropdownMenuItem>
          ) : null}
          {canRetry(post.status) ? (
            <DropdownMenuItem onClick={() => retry.mutate(post.id)}>
              <ArrowsClockwise />
              Retry failed
            </DropdownMenuItem>
          ) : null}
          {canDelete(post.status) ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <PublishNowDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        accounts={post.postAccounts.length}
        onConfirm={() => publish.mutate(post.id)}
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              {post.postAccounts.some((leg) => leg.published)
                ? "It stays up where it was already published. This only removes it from Unsora."
                : "It won't be published. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(post.id)}>
              Delete post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PostsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zone = useSchedulerTimezone();
  const { data: accounts } = useConnectedAccounts();
  const counts = usePostCounts();
  const bulkDelete = useBulkDeletePosts();

  const tab = searchParams.get("status") ?? "all";
  const accountId = searchParams.get("account") ?? "";
  const type = searchParams.get("type") ?? "all";
  const sortKey = searchParams.get("sort") ?? (tab === "scheduled" ? "upcoming" : tab === "published" ? "published" : "recent");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const q = useDebounce(search.trim(), 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const setParams = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      setSelected(new Set());
    },
    [pathname, router, searchParams],
  );

  // Keep the search box and URL in step.
  useEffect(() => {
    if ((searchParams.get("q") ?? "") !== q) setParams({ q: q || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const statuses = STATUS_TABS.find((t) => t.value === tab)?.statuses;
  const sort = SORTS[sortKey] ?? SORTS.recent;
  const filters: PostFilters = {
    status: statuses,
    type: TYPE_FILTERS.find((t) => t.value === type)?.types,
    accountId: accountId || undefined,
    q: q || undefined,
    sort: sort.sort,
    dir: sort.dir,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error, refetch } = usePosts(filters);
  const posts = useMemo(() => data?.posts ?? [], [data]);
  const pagination = data?.pagination;

  const countFor = (statusList?: PostStatus[]) => {
    if (!counts.data) return null;
    if (!statusList) return counts.data.total;
    return statusList.reduce((sum, s) => sum + (counts.data!.counts[s] ?? 0), 0);
  };

  const deletable = posts.filter((p) => canDelete(p.status));
  const allSelected = deletable.length > 0 && deletable.every((p) => selected.has(p.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = Boolean(q || accountId || type !== "all");

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(value) => setParams({ status: value === "all" ? null : (value as string), sort: null })}>
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto no-scrollbar max-sm:pr-8 max-sm:mask-r-from-85%"
        >
          {STATUS_TABS.map((t) => {
            const count = countFor(t.statuses);
            return (
              <TabsTrigger key={t.value} value={t.value} className="flex-none">
                {t.label}
                {count ? (
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <MagnifyingGlass />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search captions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search captions"
          />
        </InputGroup>
        <div
          role="group"
          aria-label="Filters"
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-1 sm:items-center"
        >
          <Select value={accountId || "all"} onValueChange={(value) => setParams({ account: value === "all" ? null : (value as string) })}>
            <SelectTrigger aria-label="Account" className="w-full min-w-0 sm:w-44 sm:shrink-0">
              <SelectValue>
                {(value: string) => {
                  const account = accounts?.find((a) => a.id === value);
                  return account ? accountLabel(account) : "All accounts";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {(accounts ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(value) => setParams({ type: value === "all" ? null : (value as string) })}>
            <SelectTrigger aria-label="Format" className="w-full min-w-0 sm:w-36 sm:shrink-0">
              <SelectValue>
                {(value: string) => TYPE_FILTERS.find((t) => t.value === value)?.label ?? "All formats"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(value) => setParams({ sort: value as string })}>
            <SelectTrigger aria-label="Sort" className="w-auto shrink-0 sm:ml-auto">
              <ArrowsDownUp className="sm:hidden" />
              <SelectValue className="max-sm:sr-only">
                {(value: string) => SORTS[value]?.label ?? "Sort"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {Object.entries(SORTS).map(([key, s]) => (
                <SelectItem key={key} value={key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
          <span className="text-sm">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmBulk(true)}>
              <Trash />
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <ErrorState title="Couldn't load posts" description={error.message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="No posts match"
            description="Try a different search or clear the filters."
            action={{
              label: "Clear filters",
              onClick: () => {
                setSearch("");
                setParams({ q: null, account: null, type: null });
              },
            }}
          />
        ) : (
          <EmptyState
            icon={ListChecks}
            title={EMPTY_COPY[tab]?.title ?? "No posts"}
            description={EMPTY_COPY[tab]?.description}
            action={{ label: "New post", href: "/scheduler/new" }}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl bg-muted">
          <Table>
            <TableHeader>
              <TableRow className="border-card hover:bg-transparent">
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={allSelected}
                    className="bg-card"
                    disabled={!deletable.length}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? new Set(deletable.map((p) => p.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="hidden md:table-cell">Accounts</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">When</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={isFetching ? "opacity-70 transition-opacity" : undefined}>
              {posts.map((post) => {
                const when = whenFor(post, post.scheduledTimezone || zone);
                return (
                  <TableRow
                    key={post.id}
                    data-state={selected.has(post.id) ? "selected" : undefined}
                    className="border-card data-[state=selected]:bg-accent"
                  >
                    <TableCell className="pl-3">
                      <Checkbox
                        className="bg-card"
                        aria-label={`Select "${post.mainCaption.trim().slice(0, 60) || "No caption"}"`}
                        checked={selected.has(post.id)}
                        disabled={!canDelete(post.status)}
                        onCheckedChange={() => toggle(post.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-0 w-full">
                      <div className="flex items-center gap-3">
                        <PostThumb post={post} className="bg-card" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/scheduler/posts/${post.id}`}
                            className="block truncate font-medium text-foreground hover:underline"
                          >
                            {post.mainCaption.trim() || "No caption"}
                          </Link>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {FORMATS[formatForPost(post)].label}
                            {post.source !== "WEB" ? (
                              <span className="flex items-center gap-1">
                                · <Robot className="size-3" />
                                {post.source === "MCP" ? "Agent" : "API"}
                              </span>
                            ) : null}
                            <span className="sm:hidden">· <PostStatusBadge status={post.status} /></span>
                          </p>
                          {post.error && (post.status === "FAILED" || post.status === "PARTIALLY_PUBLISHED") ? (
                            <p title={post.error} className="truncate text-xs text-destructive">
                              {readableError(post.error)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <AccountStack accounts={post.postAccounts.map((leg) => leg.account)} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <PostStatusBadge status={post.status} />
                    </TableCell>
                    <TableCell className="hidden text-sm whitespace-nowrap lg:table-cell">
                      <span className="text-muted-foreground">{when.label} </span>
                      <span className="tabular-nums">{when.at}</span>
                    </TableCell>
                    <TableCell>
                      <RowActions post={post} onOpen={() => setOpenPostId(post.id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">
            {pagination.total.toLocaleString()} posts · page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) }, false)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setParams({ page: String(page + 1) }, false)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} {selected.size === 1 ? "post" : "posts"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Scheduled posts in the selection won&apos;t go out. Anything already published stays
              up on the platforms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                bulkDelete.mutate([...selected], { onSuccess: () => setSelected(new Set()) })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PostSheet postId={openPostId} onOpenChange={(open) => !open && setOpenPostId(null)} />
    </div>
  );
}
