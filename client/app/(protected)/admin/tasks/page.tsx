"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, Eye } from "@phosphor-icons/react";
import { PageHeader } from "@/components/admin/page-header";
import { TableShell, Th, Td, Tr, Pager } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { kindLabel, KIND_LABELS } from "@/components/admin/charts";
import {
  TaskOutputDialog,
  type TaskRef,
} from "@/components/admin/task-output-dialog";
import { useAdminTasks, type TasksQuery } from "@/hooks/admin/use-admin-data";
import { useDebounce } from "@/hooks/use-debounce";
import { timeAgo } from "@/lib/admin-format";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "COMPLETED", "PROCESSING", "QUEUED", "FAILED"];

export default function AdminTasksPage() {
  const router = useRouter();
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
  const { data, isLoading, isFetching } = useAdminTasks(query);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every generation across every feature, newest first."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => reset(() => setSearchInput(e.target.value))}
            placeholder="Search by email…"
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={(v) => reset(() => setKind(v ?? "all"))}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue placeholder="Feature" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All features</SelectItem>
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => reset(() => setStatus(v ?? "all"))}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className={cn(isFetching && "opacity-60 transition-opacity")}>
          <TableShell>
            <thead>
              <tr>
                <Th>Feature</Th>
                <Th>User</Th>
                <Th>Status</Th>
                <Th>Model</Th>
                <Th>Prompt</Th>
                <Th className="text-right">Credits</Th>
                <Th>When</Th>
                <Th className="text-right">Output</Th>
              </tr>
            </thead>
            <tbody>
              {data?.tasks.map((t) => (
                <Tr
                  key={`${t.kind}-${t.id}`}
                  onClick={() => setSelected({ kind: t.kind, id: t.id })}
                >
                  <Td className="whitespace-nowrap font-medium">
                    {kindLabel(t.kind)}
                  </Td>
                  <Td className="max-w-[180px] truncate">
                    {t.userId ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/users/${t.userId}`);
                        }}
                        className="truncate text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {t.userEmail || t.userId}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td className="max-w-[140px] truncate text-xs text-muted-foreground">
                    {t.model || "—"}
                  </Td>
                  <Td className="max-w-[280px] truncate text-muted-foreground">
                    {t.label || "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{t.credits}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {timeAgo(t.createdAt)}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: t.kind, id: t.id });
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Eye className="size-3.5" /> View
                    </button>
                  </Td>
                </Tr>
              ))}
              {data?.tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No tasks match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </TableShell>
          {data && (
            <Pager
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              onPage={setPage}
            />
          )}
        </div>
      )}

      <TaskOutputDialog task={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
