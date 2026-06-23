"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  Package,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  Check,
  X,
  Pencil,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { PendingPurchaseEditSheet } from "./pending-purchase-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  /** V0.22.2 — line items on this invoice. */
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number;
  }>;
}

export function PurchaseList({
  projectId,
  purchases,
  currency,
  manageableDepartmentIds,
  approvableDepartmentIds = [],
  currentUserId,
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
  /** V0.14.4 — viewer's userId; lets the creator edit their pending rows. */
  currentUserId?: string;
}) {
  const manageSet = new Set(manageableDepartmentIds);
  const approveSet = new Set(approvableDepartmentIds);
  // V0.14.1 — head-only submitter filter
  const [submitterFilter, setSubmitterFilter] = useState<string>("all");
  const submitters = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of purchases) {
      if (!map.has(p.createdBy.id)) map.set(p.createdBy.id, p.createdBy.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [purchases]);
  const filteredPurchases = useMemo(() => {
    if (submitterFilter === "all") return purchases;
    return purchases.filter((p) => p.createdBy.id === submitterFilter);
  }, [purchases, submitterFilter]);
  const showFilter = approvableDepartmentIds.length > 0 && submitters.length > 1;
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
    <div className="space-y-3">
      {showFilter && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Filter by submitter
          </span>
          <Select value={submitterFilter} onValueChange={setSubmitterFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {submitters.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft divide-y divide-white/[0.04]">
        {filteredPurchases.map((p) => (
          <PurchaseRowItem
            key={p.id}
            projectId={projectId}
            purchase={p}
            currency={currency}
            canManage={manageSet.has(p.department.id)}
            canApprove={approveSet.has(p.department.id)}
            canEdit={
              // V0.22.2 — Either:
              //  (a) creator while still pending — full edit
              //  (b) manager (head/owner) at any time — meta-only edit
              //      (vendor/description/payment/receipt; items locked)
              (!!currentUserId &&
                p.createdBy.id === currentUserId &&
                p.status === "pending") ||
              (manageSet.has(p.department.id) && p.status !== "rejected")
            }
          />
        ))}
      </div>
    </div>
  );
}

function PurchaseRowItem({
  projectId,
  purchase: p,
  currency,
  canManage,
  canApprove,
  canEdit,
}: {
  projectId: string;
  purchase: PurchaseRow;
  currency: string;
  canManage: boolean;
  canApprove: boolean;
  /** V0.14.4 — creator-while-pending edit affordance. */
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  // V0.22.2 — collapsible items panel.
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const items = p.items ?? [];
  const hasItems = items.length > 0;

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

  // V0.14.4 — reject now requires a reason (min 3 chars).
  function reject(reason: string) {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error("A rejection reason of 3+ characters is required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/purchases/${p.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed }),
        }
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
    <div>
    <div className="flex items-start gap-4 px-5 py-3">
      {hasItems ? (
        <button
          type="button"
          className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.08] shrink-0 transition-colors"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Hide items" : "Show items"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-foreground shrink-0">
          {p.type === "rental" ? (
            <Package className="h-4 w-4" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
        </div>
      )}
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
          <span>· added by {p.createdBy.name}</span>
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
            onClick={() => setRejectOpen(true)}
            disabled={pending}
          >
            <X className="h-3 w-3" />
            Reject
          </Button>
        </div>
      )}

      {/* V0.14.4 — Reject dialog with required reason. */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject &ldquo;{p.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Give a short reason. The submitter will see this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Out of budget — try again next week."
            rows={3}
            maxLength={1000}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                reject(rejectReason);
                if (rejectReason.trim().length >= 3) {
                  setRejectOpen(false);
                  setRejectReason("");
                }
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Rejecting…" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setEditOpen(true)}
          disabled={pending}
          aria-label="Edit pending purchase"
        >
          <Pencil className="h-4 w-4" />
        </Button>
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

      {canEdit && (
        <PendingPurchaseEditSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          projectId={projectId}
          currency={currency}
          purchase={{
            id: p.id,
            name: p.name,
            amount: p.amount,
            quantity: p.quantity ?? 1,
            vendor: p.vendor,
            description: null,
            receiptUrl: p.receiptUrl,
            // V0.22.2
            status: status,
            paymentStatus: p.paymentStatus,
          }}
        />
      )}
    </div>
    {/* V0.22.2 — collapsible items panel */}
    {hasItems && expanded && (
      <div className="px-5 pb-3 pl-[60px]">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] text-xs">
          <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <div className="col-span-6">Item</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          {items.map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-12 px-3 py-1.5 items-center"
            >
              <div className="col-span-6 truncate">{it.name}</div>
              <div className="col-span-2 text-right tabular-nums">
                {it.quantity}
              </div>
              <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                {it.unitPrice !== null
                  ? formatCurrencyAmount(it.unitPrice / 100, currency)
                  : "—"}
              </div>
              <div className="col-span-2 text-right tabular-nums font-medium">
                {formatCurrencyAmount(it.lineTotal / 100, currency)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}
