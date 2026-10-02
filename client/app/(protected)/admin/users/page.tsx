"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PageHeader } from "@/components/admin/page-header";
import {
  TableShell,
  Th,
  Td,
  Tr,
  Pager,
} from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminUsers, type UsersQuery } from "@/hooks/admin/use-admin-data";
import { useDebounce } from "@/hooks/use-debounce";
import { compactNumber, formatDate } from "@/lib/admin-format";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PLAN_OPTIONS = ["all", "free", "starter", "pro", "business"];

export default function AdminUsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [plan, setPlan] = useState("all");
  const [role, setRole] = useState("all");
  const [active, setActive] = useState("all");
  const search = useDebounce(searchInput, 350);

  const query: UsersQuery = {
    page,
    limit: 25,
    search,
    plan: plan === "all" ? "" : plan,
    role: role === "all" ? "" : role,
    active: active === "all" ? "" : active,
  };
  const { data, isLoading, isFetching } = useAdminUsers(query);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Search, inspect, and manage every account."
      />

      {/* Filters */}
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
        <Filter value={plan} onChange={(v) => reset(() => setPlan(v))} placeholder="Plan" options={PLAN_OPTIONS} />
        <Filter
          value={role}
          onChange={(v) => reset(() => setRole(v))}
          placeholder="Role"
          options={["all", "USER", "ADMIN"]}
        />
        <Filter
          value={active}
          onChange={(v) => reset(() => setActive(v))}
          placeholder="Status"
          options={["all", "true", "false"]}
          labels={{ all: "All", true: "Active", false: "Inactive" }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className={cn(isFetching && "opacity-60 transition-opacity")}>
          <TableShell>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">Credits</Th>
                <Th className="text-right">Tasks</Th>
                <Th className="text-right">Accounts</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <Tr key={u.id} onClick={() => router.push(`/admin/users/${u.id}`)}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {u.email}
                      </span>
                      {u.role === "ADMIN" && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          admin
                        </Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="capitalize text-foreground">
                      {u.plan || "free"}
                    </span>
                  </Td>
                  <Td>
                    {u.isActive ? (
                      <StatusBadge status={u.isCancelled ? "QUEUED" : "COMPLETED"} />
                    ) : (
                      <span className="text-xs text-muted-foreground">inactive</span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {compactNumber(u.credits)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {compactNumber(u.taskCount)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {u.connectedAccounts}
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </Td>
                </Tr>
              ))}
              {data?.users.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No users match these filters.
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
    </div>
  );
}

function Filter({
  value,
  onChange,
  placeholder,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "all")}>
      <SelectTrigger className="w-full sm:w-[140px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {labels?.[o] ?? (o === "all" ? `All ${placeholder.toLowerCase()}s` : o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
