"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/** Reads the 1-based `?page=` param. */
export function usePageParam(): number {
  const searchParams = useSearchParams();
  const raw = Number.parseInt(searchParams.get("page") ?? "1", 10);
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
}

function pagesToShow(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, page - 1, page, page + 1, totalPages]);
  const sorted = [...pages]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) result.push("gap");
    result.push(n);
  });
  return result;
}

/** Page links that keep the other search params and use client navigation. */
export function ListPagination({
  page,
  totalPages,
  className,
}: {
  page: number;
  totalPages: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const linkProps = (target: number) => ({
    href: hrefFor(target),
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
        return;
      }
      event.preventDefault();
      router.push(hrefFor(target));
    },
  });

  const disabledProps = {
    "aria-disabled": true,
    className: "pointer-events-none opacity-50",
  };

  return (
    <Pagination className={cn("pt-2", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            {...(page > 1 ? linkProps(page - 1) : disabledProps)}
          />
        </PaginationItem>
        {pagesToShow(page, totalPages).map((entry, i) =>
          entry === "gap" ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink
                isActive={entry === page}
                className="tabular-nums"
                {...linkProps(entry)}
              >
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            {...(page < totalPages ? linkProps(page + 1) : disabledProps)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
