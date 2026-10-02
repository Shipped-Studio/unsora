"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { AdminPage } from "@/components/admin/admin-page";
import {
  EmptyRow,
  Pager,
  SkeletonRows,
  TableShell,
  Td,
  Th,
} from "@/components/admin/data-table";
import { usePlanOptions } from "@/components/admin/use-plan-options";
import { StatusDot } from "@/components/admin/status-badge";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
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
import { useAdminUsers, type UsersQuery } from "@/hooks/admin/use-admin-data";
import { useDebounce } from "@/hooks/use-debounce";
import { compactNumber, formatDate, titleCase } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const COLS = 7;

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [plan, setPlan] = useState("all");
  const [role, setRole] = useState("all");
  const [active, setActive] = useState("all");
  const search = useDebounce(searchInput, 350);
  const planOptions = usePlanOptions();

  const query: UsersQuery = {
    page,
    limit: 25,
    search,
    plan: plan === "all" ? "" : plan,
    role: role === "all" ? "" : role,
    active: active === "all" ? "" : active,
  };
  const { data, isLoading, isFetching, error, refetch } = useAdminUsers(query);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <AdminPage title="Users" description="Search, inspect and manage accounts">
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
        <Filter
          value={plan}
          onChange={(v) => reset(() => setPlan(v))}
          allLabel="All plans"
          options={planOptions.map((p) => ({ value: p, label: titleCase(p) }))}
        />
        <Filter
          value={role}
          onChange={(v) => reset(() => setRole(v))}
          allLabel="All roles"
          options={[
            { value: "USER", label: "User" },
            { value: "ADMIN", label: "Admin" },
          ]}
        />
        <Filter
          value={active}
          onChange={(v) => reset(() => setActive(v))}
          allLabel="Any status"
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
        />
      </div>

      {error && !data ? (
        <ErrorState
          title="Couldn't load users"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className={cn("space-y-3", isFetching && !isLoading && "opacity-60 transition-opacity")}>
          <TableShell>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th>User</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">Credits</Th>
                <Th className="text-right">Tasks</Th>
                <Th className="text-right">Accounts</Th>
                <Th>Joined</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !data ? (
                <SkeletonRows cols={COLS} />
              ) : data.users.length === 0 ? (
                <EmptyRow cols={COLS}>No users match these filters.</EmptyRow>
              ) : (
                data.users.map((u) => (
                  <TableRow key={u.id}>
                    <Td className="max-w-72">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="truncate font-medium underline-offset-4 hover:underline"
                        >
                          {u.email}
                        </Link>
                        {u.role === "ADMIN" ? (
                          <Badge variant="secondary">Admin</Badge>
                        ) : null}
                      </div>
                    </Td>
                    <Td>{titleCase(u.plan || "free")}</Td>
                    <Td>
                      {u.isActive ? (
                        u.isCancelled ? (
                          <StatusDot tone="warning">Ending</StatusDot>
                        ) : (
                          <StatusDot tone="success">Active</StatusDot>
                        )
                      ) : (
                        <StatusDot tone="muted">Inactive</StatusDot>
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
                    <Td className="text-muted-foreground">
                      {formatDate(u.createdAt)}
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
    </AdminPage>
  );
}

function Filter({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const items = [{ value: "all", label: allLabel }, ...options];
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange((v as string | null) ?? "all")}
      items={items}
    >
      <SelectTrigger className="w-full sm:w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
