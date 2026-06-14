"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
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
  members: { id: string; name: string }[];
  totals: {
    activeCount: number;
    pendingSettlement: number;
    totalIssued: number;
    spentViaCustody: number;
  };
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
}: Props) {
  const [issueOpen, setIssueOpen] = useState(false);

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
        {canIssue && (
          <Button className="gap-1.5" onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4" />
            Issue custody
          </Button>
        )}
      </div>

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
    </section>
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
        {row.status === "active" && row.settlementStatus !== "pending" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pending}
            onClick={() => action("request-settlement")}
          >
            Close
          </Button>
        )}
        {row.settlementStatus === "pending" && canApproveSettlement && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={pending}
            onClick={() => action("approve-settlement")}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Approve
          </Button>
        )}
        {canIssue && row.status === "active" && row.spent === 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-300"
            disabled={pending}
            onClick={cancel}
          >
            <X className="h-3 w-3" />
            Cancel
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
  members: { id: string; name: string }[];
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
