import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditPacksSkeleton } from "./credit-packs";

/** Mirrors the billing page: the two subscription cards, then the plans. */
export function BillingSkeleton() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-32" />
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <CreditPacksSkeleton />
      </section>
    </div>
  );
}
