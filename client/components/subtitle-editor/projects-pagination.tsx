"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ProjectsPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function ProjectsPagination({
  page,
  totalPages,
  onPageChange,
  className = "pt-2",
}: ProjectsPaginationProps) {
  if (totalPages <= 1) return null;

  const handle = (target: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (target < 1 || target > totalPages || target === page) return;
    onPageChange(target);
  };

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={handle(page - 1)}
            className={
              page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
            }
          />
        </PaginationItem>

        {page > 2 && (
          <PaginationItem>
            <PaginationLink onClick={handle(1)} className="cursor-pointer">
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
              onClick={handle(page - 1)}
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
              onClick={handle(page + 1)}
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
              onClick={handle(totalPages)}
              className="cursor-pointer"
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            onClick={handle(page + 1)}
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
