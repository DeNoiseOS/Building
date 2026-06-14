"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DollarSign,
  Plus,
  Building2,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BUDGET_STATUS, BUDGET_STATUS_LABELS } from "@/lib/budget-status";
import { BudgetRequestSheet } from "./budget-request-sheet";

interface Totals {
  totalRequested: number;
  totalApproved: number;
  totalPurchased: number;
  pendingApproval: number;
}

interface DeptBreakdownRow {
  departmentId: string;
  name: string;
  kind: string;
  requested: number;
  approved: number;
  purchased: number;
}

export interface BudgetRequestRow {
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
  currentUser: { id: string; name: string };
  isOwner: boolean;
  memberRole: string | null;
  canApprove: boolean;
  myDepartmentIds: string[];
  totals: Totals;
  breakdown: DeptBreakdownRow[];
  departments: { id: string; name: string }[];
  requesters: { id: string; name: string }[];
  requests: BudgetRequestRow[];
  filter: { status: string; department: string; requester: string };
}

function formatMoney(cents: number) {
  const v = cents / 100;
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const STATUS_PILL: Record<string, string> = {
  draft: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  submitted: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/25 bg-red-400/10 text-red-300",
  purchased: "border-sky-400/25 bg-sky-400/10 text-sky-300",
};

export function BudgetDashboard({
  projectId,
  currentUser,
  isOwner,
  canApprove,
  myDepartmentIds,
  totals,
  breakdown,
  departments,
  requesters,
  requests,
  filter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const canCreate =
    isOwner ||
    departments.some((d) => myDepartmentIds.includes(d.id)) ||
    canApprove;

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  }

  const editTarget = editId ? requests.find((r) => r.id === editId) : null;

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
              Workflow for requesting and approving budget.
            </p>
          </div>
        </div>
        {canCreate && (
          <Button className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            New request
          </Button>
        )}
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Requested" value={formatMoney(totals.totalRequested)} icon={<DollarSign className="h-4 w-4" />} />
        <Metric label="Approved" value={formatMoney(totals.totalApproved)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
        <Metric label="Purchased" value={formatMoney(totals.totalPurchased)} icon={<Truck className="h-4 w-4 text-sky-400" />} />
        <Metric label="Pending approval" value={formatMoney(totals.pendingApproval)} icon={<Clock className="h-4 w-4 text-amber-400" />} />
      </div>

      {/* Department breakdown */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Department breakdown
          </h3>
          <p className="text-xs text-muted-foreground">
            {breakdown.length} department{breakdown.length === 1 ? "" : "s"}
          </p>
        </div>
        {breakdown.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No departments on this project yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {breakdown.map((d) => (
              <div
                key={d.departmentId}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="font-medium truncate">{d.name}</p>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <Mini label="Requested" value={formatMoney(d.requested)} />
                  <Mini label="Approved" value={formatMoney(d.approved)} accent="emerald" />
                  <Mini label="Purchased" value={formatMoney(d.purchased)} accent="sky" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filters + list */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold">Requests</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={filter.status || "all"}
              onValueChange={(v) => setQueryParam("status", v === "all" ? "" : v)}
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
            No budget requests match these filters.
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
                <BudgetRow
                  key={r.id}
                  projectId={projectId}
                  request={r}
                  canApprove={canApprove}
                  isMe={r.requester.id === currentUser.id}
                  onEdit={() => setEditId(r.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <BudgetRequestSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        mode="create"
        projectId={projectId}
        departments={departments.filter(
          (d) => isOwner || canApprove || myDepartmentIds.includes(d.id)
        )}
      />

      {editTarget && (
        <BudgetRequestSheet
          open={!!editId}
          onOpenChange={(v) => !v && setEditId(null)}
          mode="edit"
          projectId={projectId}
          departments={departments}
          request={editTarget}
        />
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight mt-1">
        {value}
      </p>
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
  accent?: "emerald" | "sky";
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
          accent === "sky" && "text-sky-300"
        )}
      >
        {value}
      </div>
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

function BudgetRow({
  projectId,
  request,
  canApprove,
  isMe,
  onEdit,
}: {
  projectId: string;
  request: BudgetRequestRow;
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
            action === "reject"
              ? JSON.stringify({ reason: null })
              : undefined,
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
        {(request.estimatedCost / 100).toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })}
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
