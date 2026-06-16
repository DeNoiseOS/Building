"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DollarSign,
  Plus,
  Pencil,
  Wallet,
  CheckCircle2,
  XCircle,
  Truck,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ALLOCATION_STATUS_LABELS } from "@/lib/allocation-status";
import { BUDGET_STATUS, BUDGET_STATUS_LABELS } from "@/lib/budget-status";
import { BudgetRequestSheet } from "./budget-request-sheet";
import { CommentThread } from "@/components/shared/comment-thread";
import { CurrencySelect } from "@/components/shared/currency-select";

interface BudgetSummary {
  totalBudget: number | null;
  currency: string;
  allocated: number;
  approved: number;
  spent: number;
  remaining: number | null;
}

interface AllocationRow {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentKind: string;
  allocatedAmount: number;
  requestedAmount: number | null;
  approvedAmount: number | null;
  status: string;
  reason: string | null;
  spent: number;
  remaining: number | null;
  utilization: number | null;
}

interface PurchaseRequestRow {
  id: string;
  title: string;
  description: string | null;
  vendor: string | null;
  estimatedCost: number;
  needByDate: string | null;
  status: string;
  department: { id: string; name: string; kind: string };
  requester: { id: string; name: string };
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  purchasedAt: string | null;
  updatedAt: string;
}

interface Props {
  projectId: string;
  currency: string;
  totalBudget: number | null;
  budgetSummary: BudgetSummary;
  allocations: AllocationRow[];
  departments: { id: string; name: string }[];
  currentUser: { id: string; name: string };
  isOwner: boolean;
  canEditBudgetPool: boolean;
  canApprove: boolean;
  canResolveRevision: boolean;
  isAnyHead: boolean;
  isProjectWide: boolean;
  myMemberRole: string | null;
  myDepartmentIds: string[];
  requests: PurchaseRequestRow[];
  requesters: { id: string; name: string }[];
  filter: { status: string; department: string; requester: string };
}

function money(cents: number, currency: string) {
  const v = cents / 100;
  return v.toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

const STATUS_PILL: Record<string, string> = {
  draft: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  submitted: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/25 bg-red-400/10 text-red-300",
  purchased: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  pending: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  revision_requested: "border-amber-400/25 bg-amber-400/10 text-amber-200",
};

export function BudgetPanel({
  projectId,
  currency,
  totalBudget,
  budgetSummary,
  allocations,
  departments,
  currentUser,
  isOwner,
  canEditBudgetPool,
  canApprove,
  canResolveRevision,
  isAnyHead,
  isProjectWide,
  myMemberRole,
  myDepartmentIds,
  requests,
  requesters,
  filter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [poolOpen, setPoolOpen] = useState(false);
  const [newReqOpen, setNewReqOpen] = useState(false);
  const [editReqId, setEditReqId] = useState<string | null>(null);
  const [openAllocId, setOpenAllocId] = useState<string | null>(null);

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  }

  // Producer/Owner sees the whole project. Heads & members see their dept first.
  const showProjectView = isOwner || isProjectWide;
  const editTarget = editReqId ? requests.find((r) => r.id === editReqId) : null;
  const focusedAlloc = openAllocId
    ? allocations.find((a) => a.id === openAllocId)
    : null;

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Budget</h2>
            <p className="text-sm text-muted-foreground">
              Project pool, department allocations, and department expenses.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditBudgetPool && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setPoolOpen(true)}
            >
              <Wallet className="h-4 w-4" />
              {totalBudget === null ? "Set total budget" : "Edit budget"}
            </Button>
          )}
          {(isOwner ||
            canApprove ||
            isAnyHead ||
            myDepartmentIds.length > 0) && (
            <Button
              className="gap-1.5"
              onClick={() => setNewReqOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New expense
            </Button>
          )}
        </div>
      </div>

      {/* Project view metrics */}
      {showProjectView && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Total budget"
            value={totalBudget !== null ? money(totalBudget, currency) : "—"}
          />
          <Metric label="Allocated" value={money(budgetSummary.allocated, currency)} />
          <Metric label="Spent" value={money(budgetSummary.spent, currency)} />
          <Metric
            label="Remaining"
            value={
              budgetSummary.remaining !== null
                ? money(budgetSummary.remaining, currency)
                : "—"
            }
            accent={
              budgetSummary.remaining !== null && budgetSummary.remaining < 0
                ? "red"
                : undefined
            }
          />
        </div>
      )}

      {/* Department allocations */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Department allocations
          </h3>
        </div>

        {allocations.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No departments on this project yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {allocations.map((a) => (
              <AllocationCard
                key={a.departmentId}
                projectId={projectId}
                currency={currency}
                allocation={a}
                canEditBudgetPool={canEditBudgetPool}
                canResolveRevision={canResolveRevision}
                canManageThisDept={
                  isOwner ||
                  (myMemberRole !== null && myMemberRole === a.departmentKind) ||
                  myDepartmentIds.includes(a.departmentId)
                }
                onOpenDetail={() => setOpenAllocId(a.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Purchase requests */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold">Department expenses</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={filter.status || "all"}
              onValueChange={(v) =>
                setQueryParam("status", v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {BUDGET_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.department || "all"}
              onValueChange={(v) =>
                setQueryParam("department", v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.requester || "all"}
              onValueChange={(v) =>
                setQueryParam("requester", v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Requester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All requesters</SelectItem>
                {requesters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground text-center">
            No expenses recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              <tr className="border-b border-white/[0.04]">
                <Th>Title</Th>
                <Th>Department</Th>
                <Th>Requester</Th>
                <Th align="right">Est. cost</Th>
                <Th>Status</Th>
                <Th>Need by</Th>
                <Th>Updated</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <PurchaseRow
                  key={r.id}
                  projectId={projectId}
                  currency={currency}
                  request={r}
                  canApprove={canApprove}
                  isMe={r.requester.id === currentUser.id}
                  onEdit={() => setEditReqId(r.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pool editor */}
      {canEditBudgetPool && (
        <BudgetPoolSheet
          open={poolOpen}
          onOpenChange={setPoolOpen}
          projectId={projectId}
          currency={currency}
          totalBudget={totalBudget}
        />
      )}

      {/* New purchase request */}
      <BudgetRequestSheet
        open={newReqOpen}
        onOpenChange={setNewReqOpen}
        mode="create"
        projectId={projectId}
        departments={departments.filter(
          (d) => isOwner || canApprove || myDepartmentIds.includes(d.id)
        )}
      />

      {editTarget && (
        <BudgetRequestSheet
          open={!!editReqId}
          onOpenChange={(v) => !v && setEditReqId(null)}
          mode="edit"
          projectId={projectId}
          departments={departments}
          request={editTarget}
          currentUser={currentUser}
        />
      )}

      {/* Allocation detail (status + comments) */}
      {focusedAlloc && (
        <AllocationDetailSheet
          open={!!openAllocId}
          onOpenChange={(v) => !v && setOpenAllocId(null)}
          projectId={projectId}
          allocation={focusedAlloc}
          currency={currency}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "red";
}) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums tracking-tight mt-1",
          accent === "red" && "text-red-300"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-semibold",
        align === "right" && "text-right"
      )}
    >
      {children}
    </th>
  );
}

function AllocationCard({
  projectId,
  currency,
  allocation,
  canEditBudgetPool,
  canResolveRevision,
  canManageThisDept,
  onOpenDetail,
}: {
  projectId: string;
  currency: string;
  allocation: AllocationRow;
  canEditBudgetPool: boolean;
  canResolveRevision: boolean;
  canManageThisDept: boolean;
  onOpenDetail: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [allocDraft, setAllocDraft] = useState(
    String(allocation.allocatedAmount / 100)
  );
  const [reviseOpen, setReviseOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  function saveAllocation() {
    const cents = Math.round(Number(allocDraft) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      toast.error("Amount must be a number.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/budget-allocations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: allocation.departmentId,
            allocatedAmount: cents,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save allocation.");
        return;
      }
      toast.success("Allocation saved.");
      setEditing(false);
      router.refresh();
    });
  }

  function doAction(action: "accept" | "resolve_revision" | "keep_original") {
    startTransition(async () => {
      const url =
        action === "accept"
          ? `/api/projects/${projectId}/budget-allocations/${allocation.id}/accept`
          : `/api/projects/${projectId}/budget-allocations/${allocation.id}/resolve`;
      const body =
        action === "accept"
          ? undefined
          : JSON.stringify({
              decision:
                action === "resolve_revision"
                  ? "approve_revision"
                  : "keep_original",
            });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Updated.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{allocation.departmentName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className={STATUS_PILL[allocation.status]}>
              {ALLOCATION_STATUS_LABELS[allocation.status] ?? allocation.status}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="View allocation discussion"
          title="Discussion"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Mini label="Allocated" value={money(allocation.allocatedAmount, currency)} />
        <Mini
          label="Spent"
          value={money(allocation.spent, currency)}
          accent="sky"
        />
        <Mini
          label="Remaining"
          value={
            allocation.remaining !== null
              ? money(allocation.remaining, currency)
              : "—"
          }
          accent={
            allocation.remaining !== null && allocation.remaining < 0
              ? "red"
              : "emerald"
          }
        />
      </div>

      {allocation.status === "approved" && allocation.utilization !== null && (
        <div className="text-[11px] text-muted-foreground">
          Utilization: <span className="text-foreground font-medium tabular-nums">{allocation.utilization}%</span>
        </div>
      )}

      {allocation.status === "revision_requested" && (
        <div className="rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-200 text-[11px] px-2.5 py-2 space-y-0.5">
          <p className="font-medium">
            Head requested {money(allocation.requestedAmount ?? 0, currency)}
          </p>
          {allocation.reason && <p className="opacity-80">{allocation.reason}</p>}
        </div>
      )}

      {allocation.status === "rejected" && allocation.reason && (
        <div className="rounded-lg bg-red-400/10 border border-red-400/25 text-red-200 text-[11px] px-2.5 py-2">
          {allocation.reason}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {canEditBudgetPool && !editing && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" />
            Set allocation
          </Button>
        )}
        {editing && (
          <div className="flex items-center gap-1.5 w-full">
            <Input
              value={allocDraft}
              onChange={(e) => setAllocDraft(e.target.value)}
              inputMode="decimal"
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={pending}
              onClick={saveAllocation}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setAllocDraft(String(allocation.allocatedAmount / 100));
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        {!editing &&
          canManageThisDept &&
          allocation.status === "pending" && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={pending}
                onClick={() => doAction("accept")}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={pending}
                onClick={() => setReviseOpen(true)}
              >
                Request revision
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-300 hover:text-red-200"
                disabled={pending}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </>
          )}
        {!editing &&
          canResolveRevision &&
          allocation.status === "revision_requested" && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={pending}
                onClick={() => doAction("resolve_revision")}
              >
                Approve revision
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={pending}
                onClick={() => doAction("keep_original")}
              >
                Keep original
              </Button>
            </>
          )}
      </div>

      {reviseOpen && (
        <ReviseSheet
          open={reviseOpen}
          onOpenChange={setReviseOpen}
          projectId={projectId}
          allocation={allocation}
          currency={currency}
        />
      )}
      {rejectOpen && (
        <RejectSheet
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          projectId={projectId}
          allocation={allocation}
        />
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "sky" | "red";
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-semibold tabular-nums",
          accent === "emerald" && "text-emerald-300",
          accent === "sky" && "text-sky-300",
          accent === "red" && "text-red-300"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function BudgetPoolSheet({
  open,
  onOpenChange,
  projectId,
  currency,
  totalBudget,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  currency: string;
  totalBudget: number | null;
}) {
  const router = useRouter();
  const [totalDraft, setTotalDraft] = useState(
    totalBudget !== null ? String(totalBudget / 100) : ""
  );
  const [currencyDraft, setCurrencyDraft] = useState(currency);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const cents =
      totalDraft.trim() === "" ? null : Math.round(Number(totalDraft) * 100);
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) {
      toast.error("Total budget must be a non-negative number.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalBudget: cents,
          currency: currencyDraft.trim().toUpperCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save budget.");
        return;
      }
      toast.success("Project budget saved.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={save} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Project budget</SheetTitle>
            <SheetDescription>
              Set the total pool and currency. The sum of department
              allocations cannot exceed the total.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="pool-total">Total budget</Label>
              <Input
                id="pool-total"
                value={totalDraft}
                onChange={(e) => setTotalDraft(e.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to clear the pool.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-currency">Currency</Label>
              <CurrencySelect
                id="pool-currency"
                value={currencyDraft}
                onChange={setCurrencyDraft}
              />
              <p className="text-[11px] text-muted-foreground">
                Only owner / executive producer / producer can change this.
                Applies to all budgets, custodies, and expenses on the project.
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ReviseSheet({
  open,
  onOpenChange,
  projectId,
  allocation,
  currency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  allocation: AllocationRow;
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(allocation.allocatedAmount / 100));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      toast.error("Requested amount must be a number.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/budget-allocations/${allocation.id}/request-revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestedAmount: cents,
            reason: reason.trim(),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Revision requested.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Request revision</SheetTitle>
            <SheetDescription>
              Propose a different amount and explain why.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label>Requested amount ({currency})</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Additional props and set dressing required."
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Request revision"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function RejectSheet({
  open,
  onOpenChange,
  projectId,
  allocation,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  allocation: AllocationRow;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/budget-allocations/${allocation.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Allocation rejected.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Reject allocation</SheetTitle>
            <SheetDescription>Explain why this won&apos;t work.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Insufficient budget for planned set construction."
            />
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Reject"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AllocationDetailSheet({
  open,
  onOpenChange,
  projectId,
  allocation,
  currency,
  currentUser,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  allocation: AllocationRow;
  currency: string;
  currentUser: { id: string; name: string };
}) {
  void projectId;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{allocation.departmentName}</SheetTitle>
          <SheetDescription>
            {ALLOCATION_STATUS_LABELS[allocation.status] ?? allocation.status}
            {" · "}
            Allocated {money(allocation.allocatedAmount, currency)}
            {allocation.approvedAmount !== null &&
              ` · Approved ${money(allocation.approvedAmount, currency)}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {allocation.reason && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs px-3 py-2">
              {allocation.reason}
            </div>
          )}
          <CommentThread
            targetType="budget_allocation"
            targetId={allocation.id}
            currentUser={currentUser}
            compact
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PurchaseRow({
  projectId,
  currency,
  request,
  canApprove,
  isMe,
  onEdit,
}: {
  projectId: string;
  currency: string;
  request: PurchaseRequestRow;
  canApprove: boolean;
  isMe: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function doAction(action: "submit" | "approve" | "reject" | "purchase") {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/budget-requests/${request.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            action === "reject" ? JSON.stringify({ reason: null }) : undefined,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? `Failed to ${action}.`);
        return;
      }
      toast.success(`Marked ${action}d.`);
      router.refresh();
    });
  }

  const canSubmit = isMe && request.status === "draft";
  const canEdit = isMe && request.status === "draft";

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-left font-medium hover:underline"
        >
          {request.title}
        </button>
        {request.vendor && (
          <p className="text-[11px] text-muted-foreground">{request.vendor}</p>
        )}
      </td>
      <td className="px-3 py-3">{request.department.name}</td>
      <td className="px-3 py-3">{request.requester.name}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        {money(request.estimatedCost, currency)}
      </td>
      <td className="px-3 py-3">
        <Badge variant="outline" className={STATUS_PILL[request.status]}>
          {BUDGET_STATUS_LABELS[request.status] ?? request.status}
        </Badge>
      </td>
      <td className="px-3 py-3 text-muted-foreground">
        {request.needByDate
          ? new Date(request.needByDate).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-3 py-3 text-muted-foreground">
        {new Date(request.updatedAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {canSubmit && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={pending}
              onClick={() => doAction("submit")}
            >
              Submit
            </Button>
          )}
          {canApprove && request.status === "submitted" && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={pending}
                onClick={() => doAction("approve")}
              >
                <CheckCircle2 className="h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-red-300 hover:text-red-200"
                disabled={pending}
                onClick={() => doAction("reject")}
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </>
          )}
          {canApprove && request.status === "approved" && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={pending}
              onClick={() => doAction("purchase")}
            >
              <Truck className="h-3 w-3" />
              Purchased
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
