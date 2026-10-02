"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
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
import { timeAgo } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const COLS = 8;

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
        <Select
          value={kind}
          items={KIND_ITEMS}
          onValueChange={(v) => reset(() => setKind((v as string | null) ?? "all"))}
        >
          <SelectTrigger className="w-full sm:w-48">
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
          <SelectTrigger className="w-full sm:w-40">
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
                <Th>User</Th>
                <Th>Status</Th>
                <Th>Model</Th>
                <Th>Prompt</Th>
                <Th className="text-right">Credits</Th>
                <Th>When</Th>
                <Th className="text-right">Output</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !data ? (
                <SkeletonRows cols={COLS} />
              ) : data.tasks.length === 0 ? (
                <EmptyRow cols={COLS}>No tasks match these filters.</EmptyRow>
              ) : (
                data.tasks.map((t) => (
                  <TableRow key={`${t.kind}-${t.id}`}>
                    <Td className="font-medium">{kindLabel(t.kind)}</Td>
                    <Td className="max-w-48 truncate">
                      {t.userId ? (
                        <Link
                          href={`/admin/users/${t.userId}`}
                          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {t.userEmail || t.userId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="max-w-36 truncate text-xs text-muted-foreground">
                      {t.model || ""}
                    </Td>
                    <Td className="max-w-72 truncate text-muted-foreground">
                      {t.label || ""}
                    </Td>
                    <Td className="text-right tabular-nums">{t.credits}</Td>
                    <Td className="text-muted-foreground">{timeAgo(t.createdAt)}</Td>
                    <Td className="text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setSelected({ kind: t.kind, id: t.id })}
                      >
                        View
                      </Button>
                    </Td>
                  </TableRow>
                ))
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
