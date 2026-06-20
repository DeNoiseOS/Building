"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DollarSign,
  Plus,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Truck,
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
import { CommentThread } from "@/components/shared/comment-thread";
import { BudgetRequestSheet } from "./budget-request-sheet";

interface DeptRow {
  department: { id: string; name: string; kind: string };
  allocated: number;
  approved: number | null;
  spent: number;
  remaining: number | null;
  utilization: number | null;
  status: string;
  reason: string | null;
  requestedAmount: number | null;
  allocationId: string;
}

interface PurchaseRow {
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
  departments: DeptRow[];
  currentUser: { id: string; name: string };
  requests: PurchaseRow[];
  filter: { status: string };
  /** V0.6.3 — departments where the viewer is the head (can approve / record). */
  headOfDeptIds: string[];
}

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

const STATUS_PILL: Record<string, string> = {
  draft: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  submitted: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  pending_department_approval: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/25 bg-red-400/10 text-red-300",
  purchased: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  pending: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  revision_requested: "border-amber-400/25 bg-amber-400/10 text-amber-200",
};

export function DepartmentBudgetPanel({
  projectId,
  currency,
  departments,
  currentUser,
  requests,
  filter,
  headOfDeptIds,
}: Props) {
  const headSet = new Set(headOfDeptIds);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
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

  const editTarget = editReqId ? requests.find((r) => r.id === editReqId) : null;
  const focusedAlloc = openAllocId
    ? departments.find((d) => d.allocationId === openAllocId)
    : null;

  // Allow purchase request creation in any of my departments.
  const myDepts = departments.map((d) => d.department);

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Department Budget</h2>
            <p className="text-sm text-muted-foreground">
              Your department&apos;s allocation and remaining balance.
            </p>
          </div>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <DollarSign className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No department budget</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You aren&apos;t assigned to any department on this project yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {departments.map((d) => (
            <DepartmentCard
              key={d.department.id}
              projectId={projectId}
              currency={currency}
              row={d}
              onOpenDetail={() => setOpenAllocId(d.allocationId)}
            />
          ))}
        </div>
      )}

      {/* V0.13 — Expenses (BudgetRequest) section removed; superseded by
          Purchases & Rentals which lives below the Custody panel. */}

      {focusedAlloc && (
        <Sheet
          open={!!openAllocId}
          onOpenChange={(v) => !v && setOpenAllocId(null)}
        >
          <SheetContent className="w-full sm:max-w-md flex flex-col">
            <SheetHeader>
              <SheetTitle>{focusedAlloc.department.name}</SheetTitle>
              <SheetDescription>
                {ALLOCATION_STATUS_LABELS[focusedAlloc.status] ??
                  focusedAlloc.status}
                {focusedAlloc.approved !== null &&
                  ` · Approved ${money(focusedAlloc.approved, currency)}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {focusedAlloc.reason && (
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs px-3 py-2">
                  {focusedAlloc.reason}
                </div>
              )}
              <CommentThread
                targetType="budget_allocation"
                targetId={focusedAlloc.allocationId}
                currentUser={currentUser}
                compact
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function DepartmentCard({
  projectId,
  currency,
  row,
  onOpenDetail,
}: {
  projectId: string;
  currency: string;
  row: DeptRow;
  onOpenDetail: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviseOpen, setReviseOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  function doAction(action: "accept") {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/budget-allocations/${row.allocationId}/accept`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Accepted.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">
            {row.department.name} Budget
          </h3>
          <Badge variant="outline" className={STATUS_PILL[row.status]}>
            {ALLOCATION_STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open discussion"
          title="Discussion"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
        <Metric label="Allocated" value={money(row.allocated, currency)} />
        <Metric label="Spent" value={money(row.spent, currency)} accent="sky" />
        <Metric
          label="Remaining"
          value={
            row.remaining !== null ? money(row.remaining, currency) : "—"
          }
          accent={
            row.remaining !== null && row.remaining < 0 ? "red" : "emerald"
          }
        />
        <Metric
          label="Utilization"
          value={row.utilization !== null ? `${row.utilization}%` : "—"}
        />
      </div>

      {row.status === "revision_requested" && (
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-200 text-[12px] px-3 py-2">
            You requested {money(row.requestedAmount ?? 0, currency)}.
            Waiting for producer to resolve.
            {row.reason && (
              <p className="opacity-80 mt-1">{row.reason}</p>
            )}
          </div>
        </div>
      )}

      {row.status === "rejected" && row.reason && (
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-red-400/10 border border-red-400/25 text-red-200 text-[12px] px-3 py-2">
            {row.reason}
          </div>
        </div>
      )}

      {row.status === "pending" && (
        <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => doAction("accept")}
          >
            Accept allocation
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setReviseOpen(true)}
          >
            Request revision
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-300 hover:text-red-200"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
        </div>
      )}

      {reviseOpen && (
        <ReviseSheet
          open={reviseOpen}
          onOpenChange={setReviseOpen}
          projectId={projectId}
          allocationId={row.allocationId}
          allocated={row.allocated}
          currency={currency}
        />
      )}
      {rejectOpen && (
        <RejectSheet
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          projectId={projectId}
          allocationId={row.allocationId}
        />
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "red" | "emerald" | "sky";
}) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums tracking-tight mt-1",
          accent === "red" && "text-red-300",
          accent === "emerald" && "text-emerald-300",
          accent === "sky" && "text-sky-300"
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

function PurchaseRowItem({
  projectId,
  currency,
  request,
  isMe,
  isHead,
  onEdit,
}: {
  projectId: string;
  currency: string;
  request: PurchaseRow;
  isMe: boolean;
  isHead: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function doAction(
    action: "submit" | "approve" | "reject" | "purchase"
  ) {
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
      toast.success("Done.");
      router.refresh();
    });
  }

  const canSubmit = isMe && request.status === "draft";
  const canEdit = isMe && request.status === "draft";
  // V0.6.3 — department head authority on this row's department.
  const isPendingApproval =
    request.status === "submitted" ||
    request.status === "pending_department_approval";
  const canHeadApprove = isHead && isPendingApproval;
  const canHeadPurchase = isHead && request.status === "approved";

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
          {canHeadApprove && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={pending}
                onClick={() => doAction("approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-300 hover:text-red-200"
                disabled={pending}
                onClick={() => doAction("reject")}
              >
                Reject
              </Button>
            </>
          )}
          {canHeadPurchase && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={pending}
              onClick={() => doAction("purchase")}
            >
              Mark purchased
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

function ReviseSheet({
  open,
  onOpenChange,
  projectId,
  allocationId,
  allocated,
  currency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  allocationId: string;
  allocated: number;
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(allocated / 100));
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
        `/api/projects/${projectId}/budget-allocations/${allocationId}/request-revision`,
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
  allocationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  allocationId: string;
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
        `/api/projects/${projectId}/budget-allocations/${allocationId}/reject`,
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

// Imports for the inline icons referenced above in JSX.
void CheckCircle2;
void XCircle;
void Truck;
