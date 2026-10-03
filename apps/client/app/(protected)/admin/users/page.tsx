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
import { formatDate, titleCase } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const COLS = 7;
/** Columns folded into the User cell's second line below `md`. */
const MOBILE_HIDDEN = [1, 3, 4, 5, 6];

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
        <div className="-m-1 flex gap-2 overflow-x-auto p-1 no-scrollbar sm:overflow-visible">
          <Filter
            label="Plan"
            value={plan}
            onChange={(v) => reset(() => setPlan(v))}
            allLabel="All plans"
            options={planOptions.map((p) => ({ value: p, label: titleCase(p) }))}
          />
          <Filter
            label="Role"
            value={role}
            onChange={(v) => reset(() => setRole(v))}
            allLabel="All roles"
            options={[
              { value: "USER", label: "User" },
              { value: "ADMIN", label: "Admin" },
            ]}
          />
          <Filter
            label="Status"
            value={active}
            onChange={(v) => reset(() => setActive(v))}
            allLabel="Any status"
            options={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
        </div>
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
                <Th className="hidden md:table-cell">Plan</Th>
                <Th>Status</Th>
                <Th className="hidden text-right md:table-cell">Credits</Th>
                <Th className="hidden text-right md:table-cell">Tasks</Th>
                <Th className="hidden text-right md:table-cell">Accounts</Th>
                <Th className="hidden md:table-cell">Joined</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !data ? (
                <SkeletonRows cols={COLS} mobileHidden={MOBILE_HIDDEN} />
              ) : data.users.length === 0 ? (
                <EmptyRow
                  cols={COLS}
                  title="No users match these filters"
                  description="Try another plan, role, status or email."
                />
              ) : (
                data.users.map((u) => (
                  <TableRow key={u.id}>
                    <Td>
                      <div className="flex max-w-56 min-w-0 items-center gap-2 md:max-w-72">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="truncate rounded-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {u.email}
                        </Link>
                        {u.role === "ADMIN" ? (
                          <Badge variant="secondary">Admin</Badge>
                        ) : null}
                      </div>
                      <div className="max-w-56 truncate text-xs text-muted-foreground md:hidden">
                        {titleCase(u.plan || "free")} ·{" "}
                        {u.credits.toLocaleString()} credits · Joined{" "}
                        {formatDate(u.createdAt)}
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      {titleCase(u.plan || "free")}
                    </Td>
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
                    <NumberCell value={u.credits} />
                    <NumberCell value={u.taskCount} />
                    <NumberCell value={u.connectedAccounts} />
                    <Td className="hidden text-muted-foreground md:table-cell">
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

/** Exact count, muted when zero; hidden below `md`. */
function NumberCell({ value }: { value: number }) {
  return (
    <Td
      className={cn(
        "hidden text-right tabular-nums md:table-cell",
        value === 0 && "text-muted-foreground",
      )}
    >
      {value.toLocaleString()}
    </Td>
  );
}

function Filter({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
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
      <SelectTrigger aria-label={label} className="w-auto shrink-0 sm:w-36">
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
