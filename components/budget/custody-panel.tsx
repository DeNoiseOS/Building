"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  ShieldCheck,
  X,
  RotateCcw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CUSTODY_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS,
} from "@/lib/custody-status";

export interface CustodyRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  settlementStatus: string | null;
  settledAt: string | null;
  issuedAt: string;
  notes: string | null;
  spent: number;
  remaining: number;
  department: { id: string; name: string };
  holder: { id: string; name: string };
  issuedBy: { id: string; name: string };
}

interface Props {
  projectId: string;
  currency: string;
  canIssue: boolean;
  canApproveSettlement: boolean;
  custodies: CustodyRow[];
  departments: { id: string; name: string }[];
  members: { id: string; name: string; role?: string | null }[];
  totals: {
    activeCount: number;
    pendingSettlement: number;
    totalIssued: number;
    spentViaCustody: number;
  };
  /**
   * V0.14.1 — Show a "+ Request custody" button in the header for the
   * caller (members + heads alike). Pending requests appear inline.
   */
  canRequestCustody?: boolean;
  myRequestDepartments?: { id: string; name: string }[];
  custodyRequests?: Array<{
    id: string;
    amount: number;
    reason: string;
    status: "pending" | "approved" | "rejected";
    decisionReason: string | null;
    createdAt: string;
    requester: { id: string; name: string };
    department: { id: string; name: string };
  }>;
  /** Dept IDs the caller can approve/reject custody requests for. */
  approvableRequestDeptIds?: string[];
}

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

const STATUS_PILL: Record<string, string> = {
  active: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  settled: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  cancelled: "border-red-400/25 bg-red-400/10 text-red-300",
};

export function CustodyPanel({
  projectId,
  currency,
  canIssue,
  canApproveSettlement,
  custodies,
  departments,
  members,
  totals,
  canRequestCustody = false,
  myRequestDepartments = [],
  custodyRequests = [],
  approvableRequestDeptIds = [],
}: Props) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const pendingRequests = custodyRequests.filter((r) => r.status === "pending");
  const approvableSet = new Set(approvableRequestDeptIds);

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Custodies
          </h3>
          <Badge
            variant="outline"
            className="border-white/[0.08] bg-white/[0.03] text-foreground/80"
          >
            {totals.activeCount} active
          </Badge>
          {totals.pendingSettlement > 0 && (
            <Badge
              variant="outline"
              className="border-amber-400/25 bg-amber-400/10 text-amber-200"
            >
              {totals.pendingSettlement} settlement pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canRequestCustody && myRequestDepartments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setRequestOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Request custody
            </Button>
          )}
          {canIssue && (
            <Button className="gap-1.5" onClick={() => setIssueOpen(true)}>
              <Plus className="h-4 w-4" />
              Issue custody
            </Button>
          )}
        </div>
      </div>

      {/* V0.14.1 — inline pending request list (compact). Heads see
          approve/reject buttons; everyone else sees status only. */}
      {pendingRequests.length > 0 && (
        <div className="border-b border-white/[0.04] divide-y divide-white/[0.02]">
          {pendingRequests.map((r) => (
            <PendingRequestRow
              key={r.id}
              projectId={projectId}
              request={r}
              currency={currency}
              canDecide={approvableSet.has(r.department.id)}
            />
          ))}
        </div>
      )}

      {/* V0.14 — Totals strip: total issued, settled, active outstanding. */}
      {custodies.length > 0 && (() => {
        const sum = (rows: CustodyRow[]) =>
          rows.reduce((s, r) => s + r.amount, 0);
        const active = custodies.filter((c) => c.status === "active");
        const settled = custodies.filter((c) => c.status === "settled");
        const outstanding = active.reduce((s, r) => s + r.remaining, 0);
        return (
          <div className="grid grid-cols-3 divide-x divide-white/[0.04] border-b border-white/[0.04] text-xs">
            <Stat
              label="Total issued"
              value={money(sum(custodies), currency)}
            />
            <Stat
              label="Settled"
              value={money(sum(settled), currency)}
              accent="sky"
            />
            <Stat
              label="Outstanding"
              value={money(outstanding, currency)}
              accent={outstanding < 0 ? "red" : "emerald"}
            />
          </div>
        );
      })()}

      {custodies.length === 0 ? (
        <div className="px-5 py-10 text-sm text-muted-foreground text-center">
          No custodies issued yet.
        </div>
      ) : (
        <ol className="divide-y divide-white/[0.04]">
          {custodies.map((c) => (
            <CustodyRowItem
              key={c.id}
              projectId={projectId}
              row={c}
              canApproveSettlement={canApproveSettlement}
              canIssue={canIssue}
            />
          ))}
        </ol>
      )}

      {issueOpen && (
        <IssueCustodySheet
          open={issueOpen}
          onOpenChange={setIssueOpen}
          projectId={projectId}
          currency={currency}
          departments={departments}
          members={members}
        />
      )}

      {requestOpen && (
        <RequestCustodySheet
          open={requestOpen}
          onOpenChange={setRequestOpen}
          projectId={projectId}
          currency={currency}
          myDepartments={myRequestDepartments}
        />
      )}
    </section>
  );
}

/* ───────────── V0.14.1 — Inline pending custody request row ─────────────── */

function PendingRequestRow({
  projectId,
  request,
  currency,
  canDecide,
}: {
  projectId: string;
  request: {
    id: string;
    amount: number;
    reason: string;
    requester: { id: string; name: string };
    department: { id: string; name: string };
  };
  currency: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(path: "approve" | "reject") {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/custody-requests/${request.id}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: path === "reject" ? "{}" : undefined,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success(path === "approve" ? "Approved — custody issued." : "Rejected.");
      router.refresh();
    });
  }

  return (
    <div className="px-5 py-2.5 flex items-center gap-3 flex-wrap bg-amber-500/[0.04]">
      <Badge
        variant="outline"
        className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300"
      >
        Request
      </Badge>
      <span className="text-sm font-medium">{request.requester.name}</span>
      <span className="text-xs text-muted-foreground">
        · {request.department.name}
      </span>
      <span className="text-sm font-semibold tabular-nums">
        {money(request.amount, currency)}
      </span>
      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate italic">
        “{request.reason}”
      </span>
      {canDecide && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => decide("approve")}
            disabled={pending}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-muted-foreground hover:text-red-300"
            onClick={() => decide("reject")}
            disabled={pending}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────── V0.14.1 — Request custody sheet (inline) ─────────────── */

function RequestCustodySheet({
  open,
  onOpenChange,
  projectId,
  currency,
  myDepartments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  currency: string;
  myDepartments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [departmentId, setDepartmentId] = useState(myDepartments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!departmentId) return toast.error("Pick a department.");
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      return toast.error("Amount must be greater than zero.");
    }
    if (!reason.trim()) return toast.error("Justification is required.");
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/custody-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          amount: cents,
          reason: reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to submit request.");
        return;
      }
      toast.success("Request submitted.");
      setAmount("");
      setReason("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Request additional custody</SheetTitle>
            <SheetDescription>
              Your department head will review and decide.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            {myDepartments.length > 1 && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {myDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cr-amt">Amount ({currency})</Label>
              <Input
                id="cr-amt"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-reason">Justification</Label>
              <Textarea
                id="cr-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Why do you need this additional custody?"
                maxLength={2000}
                required
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CustodyRowItem({
  projectId,
  row,
  canApproveSettlement,
  canIssue,
}: {
  projectId: string;
  row: CustodyRow;
  canApproveSettlement: boolean;
  canIssue: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function action(path: "request-settlement" | "approve-settlement") {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/custodies/${row.id}/${path}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Done.");
      router.refresh();
    });
  }

  async function cancel() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/custodies/${row.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Cancelled.");
      router.refresh();
    });
  }

  // V0.14 — Restore a previously cancelled custody back to active.
  async function restore() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/custodies/${row.id}/restore`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Custody restored.");
      router.refresh();
    });
  }

  return (
    <li className="px-5 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium">{row.holder.name}</p>
          <span className="text-xs text-muted-foreground">
            · {row.department.name}
          </span>
          <Badge variant="outline" className={STATUS_PILL[row.status]}>
            {CUSTODY_STATUS_LABELS[row.status] ?? row.status}
          </Badge>
          {row.settlementStatus && (
            <Badge
              variant="outline"
              className={
                row.settlementStatus === "pending"
                  ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                  : "border-sky-400/25 bg-sky-400/10 text-sky-300"
              }
            >
              {SETTLEMENT_STATUS_LABELS[row.settlementStatus] ?? row.settlementStatus}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Issued by {row.issuedBy.name} on{" "}
          {new Date(row.issuedAt).toLocaleDateString()}
          {row.notes ? ` · ${row.notes}` : ""}
        </p>
      </div>
      <div
        className={cn(
          "grid grid-cols-3 gap-3 text-[11px] min-w-[260px]",
          "shrink-0"
        )}
      >
        <Mini label="Issued" value={money(row.amount, row.currency)} />
        <Mini label="Spent" value={money(row.spent, row.currency)} />
        <Mini
          label="Remaining"
          value={money(row.remaining, row.currency)}
          accent={row.remaining < 0 ? "red" : "emerald"}
        />
      </div>
      <div className="flex items-center gap-1.5">
        {/* V0.14.1 — "Close" / request-settlement button removed per
            workflow simplification. Cancel / Approve / Restore remain. */}
        {row.settlementStatus === "pending" && canApproveSettlement && (
          <ConfirmButton
            label="Approve"
            title="Approve settlement?"
            description={`This marks the custody for ${row.holder.name} as settled. Use Restore later if it was done by mistake.`}
            onConfirm={() => action("approve-settlement")}
            disabled={pending}
            variant="default"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
          />
        )}
        {canIssue && row.status === "active" && row.spent === 0 && (
          <ConfirmButton
            label="Cancel"
            title="Cancel this custody?"
            description={`This cancels ${money(row.amount, row.currency)} issued to ${row.holder.name}. You can Restore it later.`}
            onConfirm={cancel}
            disabled={pending}
            variant="ghost"
            destructive
            icon={<X className="h-3 w-3" />}
          />
        )}
        {/* V0.14 — Restore: bring a cancelled custody back to active. */}
        {canIssue && row.status === "cancelled" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={pending}
            onClick={restore}
          >
            <RotateCcw className="h-3 w-3" />
            Restore
          </Button>
        )}
      </div>
    </li>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "red";
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
          accent === "red" && "text-red-300"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function IssueCustodySheet({
  open,
  onOpenChange,
  projectId,
  currency,
  departments,
  members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  currency: string;
  departments: { id: string; name: string }[];
  members: { id: string; name: string; role?: string | null }[];
}) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [holderUserId, setHolderUserId] = useState(members[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }
    if (!departmentId || !holderUserId) {
      toast.error("Pick a department and holder.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/custodies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          holderUserId,
          amount: cents,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Custody issued.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Issue custody</SheetTitle>
            <SheetDescription>
              Hand cash to a holder in one department. Expenses can later be
              linked to this custody.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Holder</Label>
              <Select value={holderUserId} onValueChange={setHolderUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.role ? ` — ${m.role.replace(/_/g, " ")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({currency})</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Issuing…" : "Issue"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────── V0.14 — Custody totals stat ───────────────────── */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sky" | "emerald" | "red";
}) {
  const tone =
    accent === "sky"
      ? "text-sky-300"
      : accent === "emerald"
      ? "text-emerald-300"
      : accent === "red"
      ? "text-red-300"
      : "text-foreground";
  return (
    <div className="px-5 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </div>
      <div className={cn("mt-1 text-base font-semibold tabular-nums", tone)}>
        {value}
      </div>
    </div>
  );
}

/* ───────────────────── V0.14 — Confirm wrapper ───────────────────── */

function ConfirmButton({
  label,
  title,
  description,
  onConfirm,
  disabled,
  variant = "outline",
  destructive,
  icon,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  destructive?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant={variant}
          className={cn(
            "h-7 text-xs gap-1",
            destructive && "text-muted-foreground hover:text-red-300"
          )}
          disabled={disabled}
        >
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
