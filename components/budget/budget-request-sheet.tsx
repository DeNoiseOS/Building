"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import type { BudgetRequestRow } from "./budget-dashboard";
import { CommentThread } from "@/components/shared/comment-thread";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  projectId: string;
  departments: { id: string; name: string }[];
  request?: BudgetRequestRow;
  currentUser?: { id: string; name: string };
  /**
   * V0.6.3 — department head shortcut: record purchases directly without
   * going through draft → submit → approve.
   */
  canDirectPurchase?: boolean;
}

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function dateInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function BudgetRequestSheet({
  open,
  onOpenChange,
  mode,
  projectId,
  departments,
  request,
  currentUser,
  canDirectPurchase = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [departmentId, setDepartmentId] = useState(
    request?.department.id ?? departments[0]?.id ?? ""
  );
  const [title, setTitle] = useState(request?.title ?? "");
  const [description, setDescription] = useState(request?.description ?? "");
  const [vendor, setVendor] = useState(request?.vendor ?? "");
  const [estimatedDollars, setEstimatedDollars] = useState<string>(
    request ? String(request.estimatedCost / 100) : ""
  );
  const [needByDate, setNeedByDate] = useState(toDateInput(request?.needByDate));
  const [directPurchase, setDirectPurchase] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDepartmentId(request?.department.id ?? departments[0]?.id ?? "");
    setTitle(request?.title ?? "");
    setDescription(request?.description ?? "");
    setVendor(request?.vendor ?? "");
    setEstimatedDollars(request ? String(request.estimatedCost / 100) : "");
    setNeedByDate(toDateInput(request?.needByDate));
  }, [open, request, departments]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!departmentId) {
      toast.error("Pick a department.");
      return;
    }
    const dollarsNum = Number(estimatedDollars);
    if (!Number.isFinite(dollarsNum) || dollarsNum < 0) {
      toast.error("Estimated cost must be a number.");
      return;
    }
    const payload: Record<string, unknown> = {
      departmentId,
      title: title.trim(),
      description: description.trim() || null,
      vendor: vendor.trim() || null,
      estimatedCost: Math.round(dollarsNum * 100),
      needByDate: dateInputToIso(needByDate),
    };
    if (mode === "create" && canDirectPurchase && directPurchase) {
      payload.directPurchase = true;
    }
    startTransition(async () => {
      const url =
        mode === "create"
          ? `/api/projects/${projectId}/budget-requests`
          : `/api/projects/${projectId}/budget-requests/${request?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      toast.success(mode === "create" ? "Draft created." : "Updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New department expense" : "Edit expense"}
            </SheetTitle>
            <SheetDescription>
              Expenses belong to a department. Approvals optionally capture
              comments inline.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="br-dept">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="br-dept">
                  <SelectValue placeholder="Choose a department" />
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
              <Label htmlFor="br-title">Title</Label>
              <Input
                id="br-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hero camera rig rental"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-desc">Description</Label>
              <Textarea
                id="br-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Why this is needed."
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-vendor">Vendor (optional)</Label>
              <Input
                id="br-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="br-cost">Estimated cost (USD)</Label>
                <Input
                  id="br-cost"
                  inputMode="decimal"
                  value={estimatedDollars}
                  onChange={(e) => setEstimatedDollars(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="br-need">Need by</Label>
                <Input
                  id="br-need"
                  type="date"
                  value={needByDate}
                  onChange={(e) => setNeedByDate(e.target.value)}
                />
              </div>
            </div>
            {request && (
              <p className="text-[11px] text-muted-foreground">
                Status: {request.status}
              </p>
            )}

            {/* V0.6.3 — department head shortcut: record purchase directly. */}
            {mode === "create" && canDirectPurchase && (
              <label className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={directPurchase}
                  onChange={(e) => setDirectPurchase(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[12px]">
                  <span className="font-medium">Record as purchase</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Skip approval — your department already owns its budget.
                    Spent + Remaining update immediately.
                  </span>
                </span>
              </label>
            )}

            {/* V0.6.1 — comment thread (edit mode only). */}
            {mode === "edit" && request?.id && currentUser && (
              <div className="pt-2">
                <CommentThread
                  targetType="purchase_request"
                  targetId={request.id}
                  currentUser={currentUser}
                  compact
                />
              </div>
            )}
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending
                ? "Saving…"
                : mode === "create"
                  ? directPurchase && canDirectPurchase
                    ? "Record purchase"
                    : "Create draft"
                  : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
