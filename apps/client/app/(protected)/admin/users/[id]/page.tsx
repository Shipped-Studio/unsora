"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { BarList, ChartCard, kindLabel } from "@/components/admin/charts";
import {
  EmptyRow,
  TableShell,
  Td,
  Th,
} from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  TaskOutputDialog,
  type TaskRef,
} from "@/components/admin/task-output-dialog";
import { usePlanOptions } from "@/components/admin/use-plan-options";
import { ErrorState } from "@/components/shared/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminUserDetail } from "@/hooks/admin/types";
import {
  useAdjustCredits,
  useAdminUser,
  useUpdateAdminUser,
} from "@/hooks/admin/use-admin-data";
import {
  formatDate,
  formatDateTime,
  timeAgo,
  titleCase,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const USERS_CRUMB = [{ label: "Users", href: "/admin/users" }];

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useAdminUser(id);

  if (error && !data) {
    return (
      <AdminPage title="User" parents={USERS_CRUMB}>
        <ErrorState
          title="Couldn't load this user"
          description={error.message}
          onRetry={() => void refetch()}
        />
      </AdminPage>
    );
  }

  if (isLoading || !data) {
    return (
      <AdminPage title="User" parents={USERS_CRUMB}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        </div>
      </AdminPage>
    );
  }

  return <UserDetail id={id} data={data} />;
}

function UserDetail({ id, data }: { id: string; data: AdminUserDetail }) {
  const [selectedTask, setSelectedTask] = useState<TaskRef | null>(null);
  const u = data.user;

  return (
    <AdminPage
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{u.email}</span>
          {u.role === "ADMIN" ? <Badge variant="secondary">Admin</Badge> : null}
        </span>
      }
      parents={USERS_CRUMB}
    >
      <p className="text-sm text-muted-foreground">
        Joined {formatDate(u.createdAt)} · {data.counts.tasks.toLocaleString()} tasks ·{" "}
        {data.counts.assets.toLocaleString()} assets
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          {/* Keyed so the form re-seeds after a save refetches the user. */}
          <AccessCard key={u.updatedAt} id={id} user={u} />
          <CreditsCard id={id} credits={data.credits} />
          <Card size="sm">
            <CardHeader>
              <CardTitle>Billing</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <Row label="Stripe customer" value={u.stripeCustomerId} mono />
                <Row label="Subscription" value={u.stripeSubscriptionId} mono />
                <Row
                  label="Renews or ends"
                  value={u.stripeCurrentPeriodEnd ? formatDate(u.stripeCurrentPeriodEnd) : null}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <ChartCard title="Feature usage" description="Tasks by feature">
            <BarList
              items={data.kindCounts.map((k) => ({
                label: kindLabel(k.kind),
                value: k.count,
              }))}
              emptyLabel="No tasks yet"
            />
          </ChartCard>

          <Card size="sm">
            <CardHeader>
              <CardTitle>
                Connected accounts{" "}
                <span className="text-muted-foreground tabular-nums">
                  {data.socialAccounts.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.socialAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No connected social accounts.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.socialAccounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
                    >
                      <Avatar size="sm">
                        <AvatarImage src={a.profilePicture ?? undefined} alt="" />
                        <AvatarFallback>
                          {a.provider.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{titleCase(a.provider)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.accountUsername || a.accountName || "Unnamed account"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks">Recent tasks</TabsTrigger>
              <TabsTrigger value="ledger">Credit ledger</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-2">
              <TableShell>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>Feature</Th>
                    <Th>Status</Th>
                    <Th>Prompt</Th>
                    <Th className="text-right">Credits</Th>
                    <Th>When</Th>
                    <Th className="text-right">Output</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTasks.length === 0 ? (
                    <EmptyRow cols={6}>No tasks yet.</EmptyRow>
                  ) : (
                    data.recentTasks.map((t) => (
                      <TableRow key={`${t.kind}-${t.id}`}>
                        <Td>{kindLabel(t.kind)}</Td>
                        <Td>
                          <StatusBadge status={t.status} />
                        </Td>
                        <Td className="max-w-60 truncate text-muted-foreground">
                          {t.label || t.model || ""}
                        </Td>
                        <Td className="text-right tabular-nums">{t.credits}</Td>
                        <Td className="text-muted-foreground">{timeAgo(t.createdAt)}</Td>
                        <Td className="text-right">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedTask({ kind: t.kind, id: t.id })}
                          >
                            View
                          </Button>
                        </Td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </TableShell>
            </TabsContent>

            <TabsContent value="ledger" className="mt-2">
              <TableShell>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>Type</Th>
                    <Th>Reason</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>When</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.creditTransactions.length === 0 ? (
                    <EmptyRow cols={4}>No credit activity yet.</EmptyRow>
                  ) : (
                    data.creditTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <Td>
                          <Badge variant="outline">{titleCase(t.type.toLowerCase())}</Badge>
                        </Td>
                        <Td className="max-w-64 truncate text-muted-foreground">
                          {t.reason}
                        </Td>
                        <Td
                          className={cn(
                            "text-right font-medium tabular-nums",
                            t.amount > 0 ? "text-success" : "text-foreground",
                          )}
                        >
                          {t.amount > 0 ? "+" : t.amount < 0 ? "−" : ""}
                          {Math.abs(t.amount).toLocaleString()}
                        </Td>
                        <Td className="text-muted-foreground">
                          {formatDateTime(t.createdAt)}
                        </Td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </TableShell>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <TaskOutputDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
    </AdminPage>
  );
}

function AccessCard({ id, user }: { id: string; user: AdminUserDetail["user"] }) {
  const update = useUpdateAdminUser(id);
  const [plan, setPlan] = useState(user.plan || "free");
  const [role, setRole] = useState(user.role || "USER");
  const [status, setStatus] = useState(user.status || "");
  const [isActive, setIsActive] = useState(user.isActive);
  const [isCancelled, setIsCancelled] = useState(user.isCancelled);
  const planOptions = usePlanOptions(user.plan || "free");

  const dirty =
    plan !== (user.plan || "free") ||
    role !== (user.role || "USER") ||
    status !== (user.status || "") ||
    isActive !== user.isActive ||
    isCancelled !== user.isCancelled;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await update.mutateAsync({ plan, role, status, isActive, isCancelled });
      toast.success("User updated");
    } catch (e) {
      toast.error("Couldn't update this user", {
        description: (e as Error).message,
      });
    }
  };

  const planItems = planOptions.map((p) => ({ value: p, label: titleCase(p) }));
  const roleItems = [
    { value: "USER", label: "User" },
    { value: "ADMIN", label: "Admin" },
  ];

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Plan and access</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Plan</FieldLabel>
              <Select
                value={plan}
                items={planItems}
                onValueChange={(v) => setPlan((v as string | null) ?? "free")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {planItems.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select
                value={role}
                items={roleItems}
                onValueChange={(v) => setRole((v as string | null) ?? "USER")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleItems.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="subscription-status">
                Subscription status (raw)
              </FieldLabel>
              <Input
                id="subscription-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="active, trialing, canceled"
              />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="active-access" className="font-normal">
                Active access
              </FieldLabel>
              <Switch
                id="active-access"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="cancelling" className="font-normal">
                Cancelling at period end
              </FieldLabel>
              <Switch
                id="cancelling"
                checked={isCancelled}
                onCheckedChange={setIsCancelled}
              />
            </Field>

            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending ? <Spinner data-icon="inline-start" /> : null}
              Save changes
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function CreditsCard({ id, credits }: { id: string; credits: number }) {
  const adjust = useAdjustCredits(id);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [pendingSign, setPendingSign] = useState<1 | -1 | null>(null);

  const apply = async (sign: 1 | -1) => {
    const amount = parseInt(delta, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setPendingSign(sign);
    try {
      const res = await adjust.mutateAsync({
        delta: sign * amount,
        reason: reason || "manual",
      });
      toast.success(`Balance is now ${res.credits.toLocaleString()} credits`);
      setDelta("");
      setReason("");
    } catch (e) {
      toast.error("Couldn't adjust credits", {
        description: (e as Error).message,
      });
    } finally {
      setPendingSign(null);
    }
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2">
          Credits
          <span className="font-medium tabular-nums">
            {credits.toLocaleString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="credit-amount">Amount</FieldLabel>
            <Input
              id="credit-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-reason">Reason (optional)</FieldLabel>
            <Input
              id="credit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={adjust.isPending}
              onClick={() => void apply(1)}
            >
              {pendingSign === 1 ? <Spinner data-icon="inline-start" /> : null}
              Add
            </Button>
            <Button
              variant="outline"
              disabled={adjust.isPending}
              onClick={() => void apply(-1)}
            >
              {pendingSign === -1 ? <Spinner data-icon="inline-start" /> : null}
              Deduct
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-xs", mono && "font-mono", !value && "text-muted-foreground")}>
        {value ?? "None"}
      </dd>
    </div>
  );
}
