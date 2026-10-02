"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarBlank,
  Clock,
  FileText,
  CheckCircle,
  Plus,
  LinkSimple,
  ListBullets,
  ArrowRight,
} from "@phosphor-icons/react";
import { usePosts } from "@/hooks/use-posts";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import {
  formatDateAndTime,
  getStatusVariant,
  getStatusText,
} from "@/lib/post-utils";
import { getPlatformIcon, getPlatformName } from "@/lib/platform-utils";

export default function SchedulerPage() {
  const { data: scheduledData, isLoading: loadingScheduled } = usePosts({
    status: "SCHEDULED",
    limit: 5,
  });
  const { data: draftData, isLoading: loadingDrafts } = usePosts({
    status: "DRAFT",
    limit: 5,
  });
  const { data: publishedData, isLoading: loadingPublished } = usePosts({
    status: "PUBLISHED",
    limit: 5,
  });
  const { data: accounts, isLoading: loadingAccounts } = useConnectedAccounts();

  const scheduledCount = scheduledData?.pagination.total ?? 0;
  const draftCount = draftData?.pagination.total ?? 0;
  const publishedCount = publishedData?.pagination.total ?? 0;
  const accountCount = accounts?.length ?? 0;
  const statsLoading =
    loadingScheduled || loadingDrafts || loadingPublished || loadingAccounts;

  const upcomingPosts = scheduledData?.posts ?? [];

  const stats = [
    {
      label: "Scheduled",
      value: scheduledCount,
      icon: Clock,
      href: "/scheduler/posts/scheduled",
    },
    {
      label: "Published",
      value: publishedCount,
      icon: CheckCircle,
      href: "/scheduler/posts/published",
    },
    {
      label: "Drafts",
      value: draftCount,
      icon: FileText,
      href: "/scheduler/posts/draft",
    },
    {
      label: "Accounts",
      value: accountCount,
      icon: LinkSimple,
      href: "/scheduler/connections",
    },
  ];

  const quickLinks = [
    {
      title: "All Posts",
      description: "View and manage all your posts",
      href: "/scheduler/posts",
      icon: ListBullets,
    },
    {
      title: "Calendar",
      description: "View your posts on a calendar",
      href: "/scheduler/posts/calendar",
      icon: CalendarBlank,
    },
    {
      title: "Connections",
      description: "Manage your social media accounts",
      href: "/scheduler/connections",
      icon: LinkSimple,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Scheduler
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Create, schedule, and manage posts across your social accounts
          </p>
        </div>
        <Button
          render={<Link href="/scheduler/posts/create" />}
          size="lg"
          className="gap-2 shrink-0 w-full sm:w-auto"
        >
          <Plus className="h-5 w-5" weight="bold" />
          Create Post
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between">
                  <div className="rounded-lg bg-muted p-2.5">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    {statsLoading ? (
                      <Skeleton className="h-7 w-10 mb-1" />
                    ) : (
                      <p className="text-2xl font-semibold tabular-nums">
                        {stat.value}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Upcoming Posts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Upcoming Posts</CardTitle>
              {scheduledCount > 0 && (
                <Link href="/scheduler/posts/scheduled">
                  <Button variant="ghost" size="sm">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {loadingScheduled ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingPosts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="flex justify-center mb-3">
                    <div className="rounded-full bg-muted p-3">
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-sm font-medium">No scheduled posts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create and schedule a post to see it here
                  </p>
                  <Button
                    render={<Link href="/scheduler/posts/create" />}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    Schedule a post
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcomingPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/scheduler/posts/${post.id}`}
                      className="flex items-center gap-4 rounded-lg p-3 -mx-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex -space-x-2 shrink-0">
                        {post.postAccounts?.slice(0, 3).map((pa) => (
                          <Tooltip key={pa.id}>
                            <TooltipTrigger render={<div />}>
                              <Avatar className="h-8 w-8 border-2 border-background">
                                <AvatarImage
                                  src={pa.account.profilePicture || undefined}
                                />
                                <AvatarFallback className="text-[10px]">
                                  {getPlatformIcon(pa.account.provider, {
                                    className: "h-3.5 w-3.5",
                                  })}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              {pa.account.accountName ||
                                pa.account.accountUsername ||
                                getPlatformName(pa.account.provider)}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {(post.postAccounts?.length ?? 0) > 3 && (
                          <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-background bg-muted text-[10px] text-muted-foreground font-medium">
                            +{(post.postAccounts?.length ?? 0) - 3}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {post.mainCaption}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateAndTime(
                            new Date(post.scheduledFor || post.createdAt),
                          )}
                        </p>
                      </div>

                      <Badge
                        variant={getStatusVariant(post.status)}
                        className="text-xs shrink-0"
                      >
                        {getStatusText(post.status)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 rounded-lg p-3 -mx-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="rounded-lg bg-muted p-2 group-hover:bg-muted-foreground/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{link.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* Connected Accounts Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Accounts</CardTitle>
              <Button
                render={<Link href="/scheduler/connections" />}
                size="sm"
              >
                Manage
              </Button>
            </CardHeader>
            <CardContent>
              {loadingAccounts ? (
                <div className="flex gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-10 rounded-full" />
                  ))}
                </div>
              ) : !accounts || accounts.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No accounts connected
                  </p>
                  <Button
                    render={<Link href="/scheduler/connections" />}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    Connect accounts
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {accounts.map((account) => {
                    const displayName =
                      account.accountName ||
                      account.accountUsername ||
                      getPlatformName(account.provider);
                    return (
                      <Tooltip key={account.id}>
                        <TooltipTrigger>
                          <Avatar>
                            <AvatarImage
                              src={account.profilePicture || undefined}
                            />
                            <AvatarFallback>
                              {getPlatformIcon(account.provider, {
                                className: "h-4 w-4",
                              })}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent className="flex-col">
                          <p className="font-medium">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {getPlatformName(account.provider)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
