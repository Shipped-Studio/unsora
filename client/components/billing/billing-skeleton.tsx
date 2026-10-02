import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditPacksSkeleton } from "./credit-packs";

/** Mirrors the billing page: plan card, credit packs, credit history. */
export function BillingSkeleton() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-2 border-t">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </CardFooter>
        </Card>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <CreditPacksSkeleton />
      </section>
    </div>
  );
}
