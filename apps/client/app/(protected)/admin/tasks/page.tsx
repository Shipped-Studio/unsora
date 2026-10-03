"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, MagnifyingGlass } from "@phosphor-icons/react";
import { AdminPage } from "@/components/admin/admin-page";
import { KIND_LABELS, kindLabel } from "@/components/admin/charts";
import {
  EmptyRow,
  Pager,
  SkeletonRows,
  TableShell,
  Td,
  Th,
} from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  TaskOutputDialog,
  type TaskRef,
} from "@/components/admin/task-output-dialog";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminTasks, type TasksQuery } from "@/hooks/admin/use-admin-data";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateTime, timeAgo } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const COLS = 8;
/**
 * Columns folded into the Feature cell's second line below `md`. The view
 * column is hidden there too: the whole row opens the output.
 */
const MOBILE_HIDDEN = [1, 3, 4, 5, 6, 7];

const KIND_ITEMS = [
  { value: "all", label: "All features" },
  ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_ITEMS = [
  { value: "all", label: "All statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "QUEUED", label: "Queued" },
  { value: "FAILED", label: "Failed" },
];

export default function AdminTasksPage() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<TaskRef | null>(null);
  const search = useDebounce(searchInput, 350);

  const query: TasksQuery = {
    page,
    limit: 30,
    kind: kind === "all" ? "" : kind,
    status: status === "all" ? "" : status,
    search,
  };
  const { data, isLoading, isFetching, error, refetch } = useAdminTasks(query);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <AdminPage
      title="Tasks"
      description="Every generation across every feature, newest first"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <InputGroup className="sm:max-w-xs">
          <InputGroupInput
            value={searchInput}
            onChange={(e) => reset(() => setSearchInput(e.target.value))}
            placeholder="Search by email"
            aria-label="Search by email"
          />
          <InputGroupAddon>
            <MagnifyingGlass />
          </InputGroupAddon>
        </InputGroup>
        <div className="-m-1 flex gap-2 overflow-x-auto p-1 no-scrollbar sm:overflow-visible">
          <Select
            value={kind}
            items={KIND_ITEMS}
            onValueChange={(v) => reset(() => setKind((v as string | null) ?? "all"))}
          >
            <SelectTrigger aria-label="Feature" className="w-auto shrink-0 sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            items={STATUS_ITEMS}
            onValueChange={(v) =>
              reset(() => setStatus((v as string | null) ?? "all"))
            }
          >
            <SelectTrigger aria-label="Status" className="w-auto shrink-0 sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && !data ? (
        <ErrorState
          title="Couldn't load tasks"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className={cn("space-y-3", isFetching && !isLoading && "opacity-60 transition-opacity")}>
          <TableShell>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th>Feature</Th>
                <Th className="hidden md:table-cell">User</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Model</Th>
                <Th className="hidden md:table-cell">Prompt</Th>
                <Th className="hidden text-right md:table-cell">Credits</Th>
                <Th className="hidden md:table-cell">When</Th>
                <Th className="hidden w-12 md:table-cell">
                  <span className="sr-only">Output</span>
                </Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !data ? (
                <SkeletonRows cols={COLS} mobileHidden={MOBILE_HIDDEN} />
              ) : data.tasks.length === 0 ? (
                <EmptyRow
                  cols={COLS}
                  title="No tasks match these filters"
                  description="Try another feature, status or email."
                />
              ) : (
                data.tasks.map((t) => {
                  const open = () => setSelected({ kind: t.kind, id: t.id });
                  return (
                    <TableRow
                      key={`${t.kind}-${t.id}`}
                      onClick={open}
                      className="cursor-pointer"
                    >
                      <Td className="max-md:w-full max-md:max-w-0">
                        <div className="truncate font-medium">{kindLabel(t.kind)}</div>
                        <div className="truncate text-xs text-muted-foreground md:hidden">
                          {t.userEmail || "No user"} · {timeAgo(t.createdAt)}
                        </div>
                      </Td>
                      <Td className="hidden max-w-48 truncate md:table-cell">
                        {t.userId ? (
                          <Link
                            href={`/admin/users/${t.userId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {t.userEmail || t.userId}
                          </Link>
                        ) : (
                          <Muted />
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={t.status} />
                      </Td>
                      <Td className="hidden max-w-44 truncate text-muted-foreground md:table-cell">
                        {t.model ? (
                          <span title={t.model} className="font-mono text-xs leading-5">
                            {t.model}
                          </span>
                        ) : (
                          <Muted />
                        )}
                      </Td>
                      <Td className="hidden max-w-72 truncate text-muted-foreground md:table-cell">
                        {t.label || <Muted />}
                      </Td>
                      <Td
                        className={cn(
                          "hidden text-right tabular-nums md:table-cell",
                          !t.credits && "text-muted-foreground",
                        )}
                      >
                        {t.credits.toLocaleString()}
                      </Td>
                      <Td className="hidden text-muted-foreground md:table-cell">
                        <time dateTime={t.createdAt} title={timeAgo(t.createdAt)}>
                          {formatDateTime(t.createdAt)}
                        </time>
                      </Td>
                      <Td className="hidden text-right md:table-cell">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="-my-1"
                          aria-label="View output"
                          onClick={(e) => {
                            e.stopPropagation();
                            open();
                          }}
                        >
                          <Eye />
                        </Button>
                      </Td>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </TableShell>
          {data ? (
            <Pager
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              onPage={setPage}
              disabled={isFetching}
            />
          ) : null}
        </div>
      )}

      <TaskOutputDialog task={selected} onClose={() => setSelected(null)} />
    </AdminPage>
  );
}

/** Placeholder for an empty cell. */
function Muted() {
  return <span className="text-muted-foreground">—</span>;
}
