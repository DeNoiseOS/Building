"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Clock, Check, X as XIcon } from "lucide-react";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyAmount } from "@/lib/currencies";

/**
 * V0.14.1 — Custody Requests panel.
 *
 *   - Members see a "Request more custody" button + their pending requests.
 *   - Heads see the same button (they can also request) AND any pending
 *     requests addressed to their dept, with Approve/Reject buttons.
 */

export interface CustodyRequestRow {
  id: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  requester: { id: string; name: string };
  department: { id: string; name: string };
  decidedBy: { id: string; name: string } | null;
  fulfilledCustodyId: string | null;
}

export function CustodyRequestPanel({
  projectId,
  currency,
  requests,
  canRequest,
  myDepartments,
  /** Dept IDs the caller can approve/reject for (resolved head). */
  approvableDepartmentIds,
}: {
  projectId: string;
  currency: string;
  requests: CustodyRequestRow[];
  canRequest: boolean;
  myDepartments: Array<{ id: string; name: string }>;
  approvableDepartmentIds: string[];
}) {
  const approveSet = new Set(approvableDepartmentIds);

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Custody Requests</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Members ask their head for additional cash.
          </p>
        </div>
        {canRequest && myDepartments.length > 0 && (
          <RequestSheet
            projectId={projectId}
            currency={currency}
            myDepartments={myDepartments}
          />
        )}
      </div>

      {requests.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">
          No custody requests yet.
        </div>
      ) : (
        <ol className="divide-y divide-white/[0.04]">
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              projectId={projectId}
              row={r}
              currency={currency}
              canDecide={approveSet.has(r.department.id)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function RequestRow({
  projectId,
  row,
  currency,
  canDecide,
}: {
  projectId: string;
  row: CustodyRequestRow;
  currency: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(path: "approve" | "reject") {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/custody-requests/${row.id}/${path}`,
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
    <li className="px-5 py-3 flex items-start gap-4 flex-wrap">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{row.requester.name}</span>
          <span className="text-xs text-muted-foreground">
            · {row.department.name}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrencyAmount(row.amount / 100, currency)}
          </span>
          {row.status === "pending" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300 gap-1"
            >
              <Clock className="h-3 w-3" /> Pending
            </Badge>
          )}
          {row.status === "approved" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-300 gap-1"
            >
              <Check className="h-3 w-3" /> Approved
            </Badge>
          )}
          {row.status === "rejected" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-red-500/10 border-red-500/30 text-red-300 gap-1"
            >
              <XIcon className="h-3 w-3" /> Rejected
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{row.reason}</p>
        {row.status === "rejected" && row.decisionReason && (
          <p className="text-xs text-red-200/80 italic">
            Reason: {row.decisionReason}
          </p>
        )}
      </div>
      {canDecide && row.status === "pending" && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => decide("approve")}
            disabled={pending}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-300"
            onClick={() => decide("reject")}
            disabled={pending}
          >
            <XIcon className="h-3 w-3" />
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

function RequestSheet({
  projectId,
  currency,
  myDepartments,
}: {
  projectId: string;
  currency: string;
  myDepartments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Request custody
        </Button>
      </SheetTrigger>
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
