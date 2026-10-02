"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { usePosts } from "@/hooks/use-posts";
import { PostCalendar } from "@/components/scheduler/post-calendar";
import Link from "next/link";

type ViewMode = "month" | "week";

export default function CalendarPostsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const { data, isLoading, error } = usePosts({
    limit: 100,
  });

  const prevMonth = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground flex items-center gap-2">
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all posts on a calendar
          </p>
        </div>

        <Button
          render={<Link href="/scheduler/posts/create" />}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </Button>
      </div>

      {/* Calendar Component */}
      <PostCalendar
        posts={data?.posts || []}
        viewMode={viewMode}
        currentDate={currentDate}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onChangeViewMode={changeViewMode}
        isLoading={isLoading}
        error={error?.message}
      />
    </div>
  );
}
