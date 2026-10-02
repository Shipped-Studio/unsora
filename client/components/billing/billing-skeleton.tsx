import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the billing page. Mirrors the real layout exactly so
 * there's no jump when the data resolves: header, current-plan card,
 * top-up packs grid, plans grid, cancel strip.
 *
 * Built on the same `Card` primitives as the real components so the rounded
 * corners, ring and padding are pixel-identical to the resolved state.
 *
 * Top-up + cancel sections render optimistically — they're paid-only in the
 * real page, but during loading we don't yet know `isPaid` and showing them
 * avoids a second layout shift on resolve for the common (paid) case.
 */
export function BillingSkeleton() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </CardHeader>
        </Card>

        <div className="mb-8">
          <div className="mb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-72" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <TopUpPackSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="mb-8">
          <Skeleton className="mb-4 h-5 w-20" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <PlanCardSkeleton key={i} />
            ))}
          </div>
        </div>

        <Card className="ring-destructive/20">
          <CardHeader>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-72" />
            </div>
            <div className="ml-auto">
              <Skeleton className="h-8 w-24" />
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function TopUpPackSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>

        <div className="mt-1 flex items-baseline gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>

        <Skeleton className="mt-3 h-3 w-full" />
      </CardContent>

      <CardFooter>
        <Skeleton className="h-8 w-full" />
      </CardFooter>
    </Card>
  );
}

function PlanCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-44" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-4 w-10" />
        </div>

        <Skeleton className="mt-3 h-3 w-32" />

        <ul className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-start gap-2">
              <Skeleton className="mt-0.5 size-3.5 rounded-sm" />
              <Skeleton
                className="h-3 flex-1"
                style={{ maxWidth: `${60 + ((i * 7) % 40)}%` }}
              />
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Skeleton className="h-8 w-full" />
      </CardFooter>
    </Card>
  );
}
