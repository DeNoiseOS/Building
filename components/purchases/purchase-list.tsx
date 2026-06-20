"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShoppingCart,
  Package,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyAmount } from "@/lib/currencies";

export interface PurchaseRow {
  id: string;
  type: "purchase" | "rental";
  categoryKey: string;
  customCategory: string | null;
  name: string;
  quantity?: number;
  amount: number;
  vendor: string | null;
  purchaseDate: string | null;
  rentalStart: string | null;
  rentalEnd: string | null;
  receiptUrl: string | null;
  paymentStatus: "paid" | "unpaid";
  /** V0.14 — approval status. */
  status?: "pending" | "approved" | "rejected";
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  department: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export function PurchaseList({
  projectId,
  purchases,
  currency,
  manageableDepartmentIds,
  approvableDepartmentIds = [],
}: {
  projectId: string;
  purchases: PurchaseRow[];
  currency: string;
  /**
   * V0.13 — Dept IDs the caller can delete from. Pass [] for read-only.
   * (We can't accept a function prop because PurchaseList is a client
   * component and functions can't be serialized across the boundary.)
   */
  manageableDepartmentIds: string[];
  /**
   * V0.14 — Dept IDs the caller can approve/reject pending purchases for
   * (= depts where they are the resolved head). Pass [] for none.
   */
  approvableDepartmentIds?: string[];
}) {
  const manageSet = new Set(manageableDepartmentIds);
  const approveSet = new Set(approvableDepartmentIds);
  if (purchases.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] py-10 px-6 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground/60" />
        <p className="mt-3 text-sm text-muted-foreground">
          No purchases recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft divide-y divide-white/[0.04]">
      {purchases.map((p) => (
        <PurchaseRowItem
          key={p.id}
          projectId={projectId}
          purchase={p}
          currency={currency}
          canManage={manageSet.has(p.department.id)}
          canApprove={approveSet.has(p.department.id)}
        />
      ))}
    </div>
  );
}

function PurchaseRowItem({
  projectId,
  purchase: p,
  currency,
  canManage,
  canApprove,
}: {
  projectId: string;
  purchase: PurchaseRow;
  currency: string;
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/purchases/${p.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete.");
        return;
      }
      toast.success("Deleted.");
      router.refresh();
    });
  }

  function approve() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/purchases/${p.id}/approve`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Approved.");
      router.refresh();
    });
  }

  function reject() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/purchases/${p.id}/reject`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Rejected.");
      router.refresh();
    });
  }

  const status = p.status ?? "approved";

  const dateLabel =
    p.type === "purchase"
      ? p.purchaseDate
        ? new Date(p.purchaseDate).toLocaleDateString()
        : "—"
      : p.rentalStart && p.rentalEnd
      ? `${new Date(p.rentalStart).toLocaleDateString()} → ${new Date(
          p.rentalEnd
        ).toLocaleDateString()}`
      : "—";

  return (
    <div className="flex items-start gap-4 px-5 py-3">
      <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-foreground shrink-0">
        {p.type === "rental" ? (
          <Package className="h-4 w-4" />
        ) : (
          <ShoppingCart className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{p.name}</span>
          {p.quantity && p.quantity > 1 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              × {p.quantity}
            </span>
          )}
          <Badge
            variant="outline"
            className="text-[10px] bg-white/[0.04] border-white/[0.06]"
          >
            {p.department.name}
          </Badge>
          {status === "pending" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300 gap-1"
            >
              <Clock className="h-3 w-3" /> Pending approval
            </Badge>
          )}
          {status === "rejected" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-red-500/10 border-red-500/30 text-red-300 gap-1"
            >
              <X className="h-3 w-3" /> Rejected
            </Badge>
          )}
          {status === "approved" && p.paymentStatus === "paid" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-300 gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> Paid
            </Badge>
          )}
          {status === "approved" && p.paymentStatus !== "paid" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300 gap-1"
            >
              <Clock className="h-3 w-3" /> Unpaid
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          <span className="tabular-nums font-medium text-foreground/85">
            {formatCurrencyAmount(p.amount / 100, currency)}
          </span>
          {p.vendor && <span>· {p.vendor}</span>}
          <span>· {dateLabel}</span>
          {p.assignee && <span>· assigned to {p.assignee.name}</span>}
        </div>
      </div>
      {p.receiptUrl && (
        <a
          href={p.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="h-3 w-3" /> Receipt
        </a>
      )}
      {/* V0.14 — Approve / Reject for pending rows when caller is head */}
      {canApprove && status === "pending" && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={approve}
            disabled={pending}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-300"
            onClick={reject}
            disabled={pending}
          >
            <X className="h-3 w-3" />
            Reject
          </Button>
        </div>
      )}
      {canManage && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={remove}
          disabled={pending}
          aria-label="Delete purchase"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
