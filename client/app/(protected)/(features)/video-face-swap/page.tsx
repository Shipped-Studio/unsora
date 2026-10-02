import { Skeleton } from "@/components/ui/skeleton";

export default function VideoFaceSwapPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="aspect-video w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="aspect-video w-full rounded-xl" />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      <div className="mt-6">
        <Skeleton className="h-11 w-full rounded-xl sm:w-48" />
      </div>
    </div>
  );
}
