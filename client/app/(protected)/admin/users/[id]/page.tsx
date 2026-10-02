"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkle,
  Plus,
  Minus,
  ShareNetwork,
  Eye,
} from "@phosphor-icons/react";
import {
  useAdminUser,
  useUpdateAdminUser,
  useAdjustCredits,
} from "@/hooks/admin/use-admin-data";
import { ChartCard, BarList, kindLabel } from "@/components/admin/charts";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  TaskOutputDialog,
  type TaskRef,
} from "@/components/admin/task-output-dialog";
import { TableShell, Th, Td, Tr } from "@/components/admin/data-table";
import {
  compactNumber,
  formatDate,
  formatDateTime,
  timeAgo,
  titleCase,
} from "@/lib/admin-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

const PLANS = ["free", "starter", "pro", "business"];

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useAdminUser(id);
  const update = useUpdateAdminUser(id);
  const adjust = useAdjustCredits(id);

  // Editable form state, seeded from the loaded user.
  const [plan, setPlan] = useState("free");
  const [role, setRole] = useState("USER");
  const [status, setStatus] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskRef | null>(null);

  useEffect(() => {
    if (data?.user) {
      setPlan(data.user.plan || "free");
      setRole(data.user.role || "USER");
      setStatus(data.user.status || "");
      setIsActive(data.user.isActive);
      setIsCancelled(data.user.isCancelled);
    }
  }, [data?.user]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-1" />
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const u = data.user;

  const dirty =
    plan !== (u.plan || "free") ||
    role !== (u.role || "USER") ||
    status !== (u.status || "") ||
    isActive !== u.isActive ||
    isCancelled !== u.isCancelled;

  const save = async () => {
    try {
      await update.mutateAsync({ plan, role, status, isActive, isCancelled });
      toast.success("User updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyCredits = async (sign: 1 | -1) => {
    const amount = parseInt(delta, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    try {
      const res = await adjust.mutateAsync({
        delta: sign * amount,
        reason: reason || "manual",
      });
      toast.success(`Balance is now ${res.credits.toLocaleString()} credits`);
      setDelta("");
      setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/admin/users")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">
              {u.email}
            </h1>
            {u.role === "ADMIN" && <Badge variant="secondary">admin</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Joined {formatDate(u.createdAt)} · {data.counts.tasks} tasks ·{" "}
            {data.counts.assets} assets
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: management */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Plan & status editor */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Plan &amp; access</h3>

            <Field label="Plan">
              <Select value={plan} onValueChange={(v) => setPlan(v ?? "free")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Role">
              <Select value={role} onValueChange={(v) => setRole(v ?? "USER")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Subscription status (raw)">
              <Input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="active / inactive / …"
              />
            </Field>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">Active access</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">Cancelling (ends soon)</Label>
              <Switch checked={isCancelled} onCheckedChange={setIsCancelled} />
            </div>

            <Button
              onClick={save}
              disabled={!dirty || update.isPending}
              className="w-full"
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {/* Credits */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Credits</h3>
              <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                <Sparkle weight="fill" className="size-4 text-primary" />
                {data.credits.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="Amount"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => applyCredits(1)}
                disabled={adjust.isPending}
                title="Grant credits"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => applyCredits(-1)}
                disabled={adjust.isPending}
                title="Deduct credits"
              >
                <Minus className="size-4" />
              </Button>
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
            />
          </div>

          {/* Billing snapshot */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
            <h3 className="mb-1 text-sm font-semibold">Billing</h3>
            <Row label="Stripe customer" value={u.stripeCustomerId ?? "—"} mono />
            <Row label="Subscription" value={u.stripeSubscriptionId ?? "—"} mono />
            <Row
              label="Renews / ends"
              value={formatDate(u.stripeCurrentPeriodEnd)}
            />
          </div>
        </div>

        {/* Right: activity */}
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

          {/* Connected accounts */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShareNetwork className="size-4" /> Connected accounts (
              {data.socialAccounts.length})
            </h3>
            {data.socialAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected social accounts.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.socialAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <Avatar className="size-7">
                      <AvatarImage src={a.profilePicture ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {a.provider.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-xs font-medium capitalize text-foreground">
                        {a.provider}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {a.accountUsername || a.accountName || "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity — tasks & credit ledger as tabs */}
          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks">Recent tasks</TabsTrigger>
              <TabsTrigger value="ledger">Credit ledger</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-3">
            <TableShell>
              <thead>
                <tr>
                  <Th>Feature</Th>
                  <Th>Status</Th>
                  <Th>Prompt</Th>
                  <Th className="text-right">Credits</Th>
                  <Th>When</Th>
                  <Th className="text-right">Output</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentTasks.map((t) => (
                  <Tr
                    key={`${t.kind}-${t.id}`}
                    onClick={() => setSelectedTask({ kind: t.kind, id: t.id })}
                  >
                    <Td className="whitespace-nowrap">{kindLabel(t.kind)}</Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="max-w-[240px] truncate text-muted-foreground">
                      {t.label || t.model || "—"}
                    </Td>
                    <Td className="text-right tabular-nums">{t.credits}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {timeAgo(t.createdAt)}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground">
                        <Eye className="size-3.5" /> View
                      </span>
                    </Td>
                  </Tr>
                ))}
                {data.recentTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      No tasks yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </TableShell>
            </TabsContent>

            <TabsContent value="ledger" className="mt-3">
            <TableShell>
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th>Reason</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {data.creditTransactions.map((t) => (
                  <Tr key={t.id}>
                    <Td>
                      <Badge variant="outline" className="capitalize">
                        {titleCase(t.type)}
                      </Badge>
                    </Td>
                    <Td className="max-w-[260px] truncate text-muted-foreground">
                      {t.reason}
                    </Td>
                    <Td
                      className={`text-right tabular-nums font-medium ${
                        t.amount >= 0 ? "text-[#0a8a0a]" : "text-destructive"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount.toLocaleString()}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                    </Td>
                  </Tr>
                ))}
                {data.creditTransactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      No credit activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </TableShell>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <TaskOutputDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`truncate text-xs text-foreground ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
