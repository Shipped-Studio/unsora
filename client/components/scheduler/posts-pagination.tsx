"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PostsPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Standard pagination control used by every paginated scheduler list page.
 * Handles previous / current / next + first / last with ellipses.
 *
 * Renders nothing when there's only one page.
 */
export function PostsPagination({
  page,
  totalPages,
  onPageChange,
}: PostsPaginationProps) {
  if (totalPages <= 1) return null;

  const goPrev = () => {
    if (page > 1) onPageChange(page - 1);
  };
  const goNext = () => {
    if (page < totalPages) onPageChange(page + 1);
  };

  return (
    <Pagination className="pt-4">
      <PaginationContent className="flex-wrap justify-center">
        <PaginationItem>
          <PaginationPrevious
            onClick={goPrev}
            className={
              page === 1
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          />
        </PaginationItem>

        {page > 2 && (
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(1)}
              className="cursor-pointer"
            >
              1
            </PaginationLink>
          </PaginationItem>
        )}

        {page > 3 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {page > 1 && (
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(page - 1)}
              className="cursor-pointer"
            >
              {page - 1}
            </PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationLink isActive className="cursor-default">
            {page}
          </PaginationLink>
        </PaginationItem>

        {page < totalPages && (
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(page + 1)}
              className="cursor-pointer"
            >
              {page + 1}
            </PaginationLink>
          </PaginationItem>
        )}

        {page < totalPages - 2 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {page < totalPages - 1 && (
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(totalPages)}
              className="cursor-pointer"
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            onClick={goNext}
            className={
              page >= totalPages
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
