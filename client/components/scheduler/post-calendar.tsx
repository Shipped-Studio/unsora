"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CalendarBlank as CalendarIcon,
} from "@phosphor-icons/react";
import { Post } from "@/hooks/use-posts";
import { CalendarSkeleton } from "@/components/scheduler/post-card-skeleton";
import {
  getStatusIcon,
  getStatusVariant,
  formatDateAndTime,
} from "@/lib/post-utils";
import {
  getPlatformIcon,
  getPlatformName,
  formatHandle,
} from "@/lib/platform-utils";
import Link from "next/link";

type ViewMode = "month" | "week";

interface PostCalendarProps {
  posts: Post[];
  viewMode: ViewMode;
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  isLoading?: boolean;
  error?: string;
}

// Post item component with popover
function CalendarPostItem({ post }: { post: Post }) {
  return (
    <Popover>
      <PopoverTrigger>
        <div className="flex items-center gap-1.5 text-xs hover:bg-muted p-1 rounded cursor-pointer">
          {getStatusIcon(post.status, "h-3 w-3")}
          <span className="line-clamp-1 flex-1 text-left">
            {post.mainCaption.length > 30
              ? `${post.mainCaption.substring(0, 30)}...`
              : post.mainCaption}
          </span>
          <Badge
            variant={getStatusVariant(post.status)}
            className="text-[9px] h-4 px-1"
          >
            {post.status.toLowerCase()}
          </Badge>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          {/* Header with status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(post.status, "h-4 w-4")}
              <Badge
                variant={getStatusVariant(post.status)}
                className="text-xs"
              >
                {post.status.toLowerCase()}
              </Badge>
            </div>
            <Link
              href={`/scheduler/posts/${post.id}`}
              className="text-xs hover:underline"
            >
              View Details
            </Link>
          </div>

          {/* Caption */}
          <div>
            <p className="text-sm font-medium mb-1">Caption</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {post.mainCaption}
            </p>
          </div>

          {/* Date */}
          <div>
            <p className="text-sm font-medium mb-1">
              {post.scheduledFor ? "Scheduled For" : "Published At"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateAndTime(
                new Date(
                  post.scheduledFor || post.publishedAt || post.createdAt,
                ),
              )}
            </p>
          </div>

          {/* Accounts */}
          {post.postAccounts && post.postAccounts.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                Accounts ({post.postAccounts.length})
              </p>
              <div className="space-y-2">
                {post.postAccounts.map((postAccount) => {
                  const account = postAccount.account;
                  const displayName =
                    account.accountName || account.accountUsername || "Unknown";
                  const platformName = getPlatformName(account.provider);

                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={account.profilePicture || undefined}
                        />
                        <AvatarFallback className="text-[10px]">
                          {displayName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{displayName}</p>
                        {account.accountUsername && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {formatHandle(account.accountUsername)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {getPlatformIcon(account.provider, {
                          className: "h-3 w-3",
                        })}
                        <span className="text-[10px]">{platformName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Account avatars component with tooltip
function PostAccounts({ post }: { post: Post }) {
  if (!post.postAccounts || post.postAccounts.length === 0) {
    return null;
  }

  const maxVisible = 4;
  const visibleAccounts = post.postAccounts.slice(0, maxVisible);
  const remainingCount = post.postAccounts.length - maxVisible;

  return (
    <div className="flex items-center -space-x-1">
      {visibleAccounts.map((postAccount) => {
        const account = postAccount.account;
        const displayName =
          account.accountName || account.accountUsername || "Unknown";
        const platformName = getPlatformName(account.provider);

        return (
          <Tooltip key={account.id}>
            <TooltipTrigger>
              <Avatar className="h-5 w-5 border-2 border-background hover:z-10 transition-transform hover:scale-110">
                <AvatarImage src={account.profilePicture || undefined} />
                <AvatarFallback className="text-[8px]">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-medium text-xs">{displayName}</p>
                {account.accountUsername && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatHandle(account.accountUsername)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {platformName}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {remainingCount > 0 && (
        <div className="flex items-center justify-center h-5 w-5 rounded-full border-2 border-background bg-muted text-[8px] text-muted-foreground font-medium">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

export function PostCalendar({
  posts,
  viewMode,
  currentDate,
  onPrevMonth,
  onNextMonth,
  onChangeViewMode,
  isLoading,
  error,
}: PostCalendarProps) {
  // Get month and year
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Month names
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Day names
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get first day of month
  const firstDay = new Date(year, month, 1).getDay();

  // Get number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get number of days in previous month
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Get today's date
  const today = new Date();

  // Check if date is today
  const isToday = (day: number, currentMonth: boolean) => {
    return (
      currentMonth &&
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Check if date is in the past
  const isPastDate = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    return dateToCheck < todayStart;
  };

  // Organize posts by date
  const postsByDate = useMemo(() => {
    const postMap = new Map<string, Post[]>();

    if (posts) {
      posts.forEach((post) => {
        // Use scheduled date if available, otherwise use published date
        const dateString =
          post.scheduledFor || post.publishedAt || post.createdAt;
        const date = new Date(dateString);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

        if (!postMap.has(key)) {
          postMap.set(key, []);
        }
        postMap.get(key)?.push(post);
      });
    }

    return postMap;
  }, [posts]);

  // Generate calendar days with posts
  const generateCalendarDays = () => {
    const days = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const yearOfPrev = month === 0 ? year - 1 : year;
      const monthOfPrev = month === 0 ? 11 : month - 1;
      const key = `${yearOfPrev}-${monthOfPrev}-${day}`;

      days.push({
        day,
        currentMonth: false,
        month: monthOfPrev,
        year: yearOfPrev,
        posts: postsByDate.get(key) || [],
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${year}-${month}-${i}`;
      days.push({
        day: i,
        currentMonth: true,
        month: month,
        year: year,
        posts: postsByDate.get(key) || [],
      });
    }

    // Next month days
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const yearOfNext = month === 11 ? year + 1 : year;
      const monthOfNext = month === 11 ? 0 : month + 1;
      const key = `${yearOfNext}-${monthOfNext}-${i}`;

      days.push({
        day: i,
        currentMonth: false,
        month: monthOfNext,
        year: yearOfNext,
        posts: postsByDate.get(key) || [],
      });
    }

    return days;
  };

  // Generate week view days with posts
  const generateWeekDays = () => {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      days.push({
        day: date.getDate(),
        currentMonth: date.getMonth() === month,
        month: date.getMonth(),
        year: date.getFullYear(),
        fullDate: date,
        posts: postsByDate.get(key) || [],
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-[400px] sm:min-h-[600px] flex items-center justify-center px-4 text-center">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <p>Failed to load posts</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Navigation and View Mode Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center justify-center sm:justify-start">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm sm:text-base font-medium min-w-[150px] text-center text-foreground">
            {monthNames[month]} {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => onChangeViewMode("month")}
          >
            <CalendarIcon className="w-4 h-4 mr-1" />
            Month
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => onChangeViewMode("week")}
          >
            <CalendarIcon className="w-4 h-4 mr-1" />
            Week
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
        {viewMode === "month" ? (
          <div className="grid grid-cols-7 min-w-[640px]">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-sm border-b border-r last:border-r-0 bg-muted/50"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((dayInfo, index) => (
              <div
                key={index}
                className={`min-h-[90px] sm:min-h-[120px] p-2 sm:p-3 border-b border-r last:border-r-0 relative group ${
                  index >= calendarDays.length - 7 ? "border-b-0" : ""
                } ${
                  isToday(dayInfo.day, dayInfo.currentMonth)
                    ? "bg-primary/10"
                    : dayInfo.currentMonth
                      ? "bg-card hover:bg-muted/50 cursor-pointer"
                      : "bg-muted/30"
                }`}
              >
                {dayInfo.currentMonth ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-foreground">
                        {monthNames[month].slice(0, 3)} {dayInfo.day}
                      </div>
                      {/* Plus button on hover - only for current and future dates */}
                      {!isPastDate(dayInfo.day) && (
                        <Link href="/scheduler/posts/create">
                          <Button
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Create post for this date"
                          >
                            +
                          </Button>
                        </Link>
                      )}
                    </div>
                    {dayInfo.posts && dayInfo.posts.length > 0 ? (
                      <div className="space-y-1.5">
                        {dayInfo.posts.map((post) => (
                          <div key={post.id} className="space-y-1">
                            <CalendarPostItem post={post} />
                            <PostAccounts post={post} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No posts
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 min-w-[640px]">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-sm border-b border-r last:border-r-0 bg-muted/50"
              >
                {day}
              </div>
            ))}

            {/* Week view days */}
            {generateWeekDays().map((dayInfo, index) => (
              <div
                key={index}
                className={`min-h-[280px] sm:min-h-[400px] p-2 sm:p-3 border-b border-r last:border-r-0 ${
                  isToday(dayInfo.day, dayInfo.currentMonth)
                    ? "bg-primary/10"
                    : "bg-card"
                }`}
              >
                <div className="text-sm font-medium mb-2 text-foreground">
                  {dayInfo.day}
                </div>
                {dayInfo.posts && dayInfo.posts.length > 0 ? (
                  <div className="space-y-2.5">
                    {dayInfo.posts.map((post) => (
                      <div key={post.id} className="space-y-1.5">
                        <Popover>
                          <PopoverTrigger>
                            <div className="flex items-start gap-1.5 text-xs hover:bg-muted p-1.5 rounded cursor-pointer">
                              {getStatusIcon(post.status, "h-3.5 w-3.5 mt-0.5")}
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="line-clamp-2 font-medium text-left">
                                  {post.mainCaption}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatDateAndTime(
                                    new Date(
                                      post.scheduledFor ||
                                        post.publishedAt ||
                                        post.createdAt,
                                    ),
                                  )}
                                </span>
                              </div>
                              <Badge
                                variant={getStatusVariant(post.status)}
                                className="text-[9px] h-4 px-1 shrink-0"
                              >
                                {post.status.toLowerCase()}
                              </Badge>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="start">
                            <div className="space-y-3">
                              {/* Header with status */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(post.status, "h-4 w-4")}
                                  <Badge
                                    variant={getStatusVariant(post.status)}
                                    className="text-xs"
                                  >
                                    {post.status.toLowerCase()}
                                  </Badge>
                                </div>
                                <Link
                                  href={`/scheduler/posts/${post.id}`}
                                  className="text-xs hover:underline"
                                >
                                  View Details
                                </Link>
                              </div>

                              {/* Caption */}
                              <div>
                                <p className="text-sm font-medium mb-1">
                                  Caption
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {post.mainCaption}
                                </p>
                              </div>

                              {/* Date */}
                              <div>
                                <p className="text-sm font-medium mb-1">
                                  {post.scheduledFor
                                    ? "Scheduled For"
                                    : "Published At"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateAndTime(
                                    new Date(
                                      post.scheduledFor ||
                                        post.publishedAt ||
                                        post.createdAt,
                                    ),
                                  )}
                                </p>
                              </div>

                              {/* Accounts */}
                              {post.postAccounts &&
                                post.postAccounts.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">
                                      Accounts ({post.postAccounts.length})
                                    </p>
                                    <div className="space-y-2">
                                      {post.postAccounts.map((postAccount) => {
                                        const account = postAccount.account;
                                        const displayName =
                                          account.accountName ||
                                          account.accountUsername ||
                                          "Unknown";
                                        const platformName = getPlatformName(
                                          account.provider,
                                        );

                                        return (
                                          <div
                                            key={account.id}
                                            className="flex items-center gap-2 text-xs"
                                          >
                                            <Avatar className="h-6 w-6">
                                              <AvatarImage
                                                src={
                                                  account.profilePicture ||
                                                  undefined
                                                }
                                              />
                                              <AvatarFallback className="text-[10px]">
                                                {displayName
                                                  .substring(0, 2)
                                                  .toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium truncate">
                                                {displayName}
                                              </p>
                                              {account.accountUsername && (
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                  {formatHandle(account.accountUsername)}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                              {getPlatformIcon(
                                                account.provider,
                                                { className: "h-3 w-3" },
                                              )}
                                              <span className="text-[10px]">
                                                {platformName}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <PostAccounts post={post} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No posts</div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
