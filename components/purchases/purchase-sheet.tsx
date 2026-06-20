"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
import { Plus, ShoppingCart, Package, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * V0.13 — Purchase Sheet.
 *
 * Universal sheet for recording a purchase or rental. Three steps:
 *   1. Type            — Purchase / Rental
 *   2. Category        — department-specific list + universal "Other"
 *      → "Other" exposes a customCategory text input and an explicit
 *        "Save as a Resource (Asset)" toggle.
 *   3. Details         — name, amount, vendor, dates, assignee, receipt,
 *                        payment status.
 *
 * Categories are passed in from the server (already includes "Other").
 */

interface Category {
  key: string;
  label: string;
  isResource: boolean;
}

interface DeptOption {
  id: string;
  name: string;
  key: string;
}

interface MemberOption {
  id: string;
  name: string;
}

export interface PurchaseSheetProps {
  projectId: string;
  /** Departments the caller is allowed to record for (resolved heads only). */
  myDepartments: DeptOption[];
  /** Map of departmentKey → purchase categories. */
  purchaseCategoriesByDept: Record<string, Category[]>;
  /** Map of departmentKey → rental categories. */
  rentalCategoriesByDept: Record<string, Category[]>;
  /** Project members eligible to be assignees. */
  members: MemberOption[];
  /** Project's currency (e.g., "SAR"). Display only. */
  currency: string;
  /** Optional pre-selected dept (when opened from a dept page). */
  defaultDepartmentId?: string;
  /** Custom trigger; defaults to a primary button labelled "Record purchase". */
  trigger?: React.ReactNode;
}

type Step = 1 | 2 | 3;
type PurchaseType = "purchase" | "rental";

export function PurchaseSheet({
  projectId,
  myDepartments,
  purchaseCategoriesByDept,
  rentalCategoriesByDept,
  members,
  currency,
  defaultDepartmentId,
  trigger,
}: PurchaseSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();

  const [departmentId, setDepartmentId] = useState<string>(
    defaultDepartmentId ?? myDepartments[0]?.id ?? ""
  );
  const [type, setType] = useState<PurchaseType>("purchase");
  const [categoryKey, setCategoryKey] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [saveAsResource, setSaveAsResource] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [rentalStart, setRentalStart] = useState("");
  const [rentalEnd, setRentalEnd] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<"paid" | "unpaid">("unpaid");

  const selectedDept = useMemo(
    () => myDepartments.find((d) => d.id === departmentId) ?? null,
    [departmentId, myDepartments]
  );
  const categories: Category[] = useMemo(() => {
    if (!selectedDept) return [];
    return type === "purchase"
      ? purchaseCategoriesByDept[selectedDept.key] ?? []
      : rentalCategoriesByDept[selectedDept.key] ?? [];
  }, [selectedDept, type, purchaseCategoriesByDept, rentalCategoriesByDept]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.key === categoryKey) ?? null,
    [categories, categoryKey]
  );

  const rentalDays = useMemo(() => {
    if (type !== "rental" || !rentalStart || !rentalEnd) return null;
    const s = new Date(rentalStart);
    const e = new Date(rentalEnd);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }, [type, rentalStart, rentalEnd]);

  function reset() {
    setStep(1);
    setDepartmentId(defaultDepartmentId ?? myDepartments[0]?.id ?? "");
    setType("purchase");
    setCategoryKey("");
    setCustomCategory("");
    setSaveAsResource(false);
    setName("");
    setDescription("");
    setQuantity("1");
    setAmount("");
    setVendor("");
    setAssigneeId("");
    setPurchaseDate("");
    setRentalStart("");
    setRentalEnd("");
    setReceiptUrl("");
    setPaymentStatus("unpaid");
  }

  useEffect(() => {
    // When type changes, clear the category since available list changes.
    setCategoryKey("");
    setCustomCategory("");
    setSaveAsResource(false);
  }, [type, departmentId]);

  function next() {
    if (step === 1) {
      if (!departmentId) return toast.error("Pick a department.");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!categoryKey) return toast.error("Pick a category.");
      if (categoryKey === "other" && !customCategory.trim()) {
        return toast.error("Name your custom category.");
      }
      setStep(3);
      return;
    }
  }

  function back() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    const qty = Math.round(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return toast.error("Quantity must be at least 1.");
    }
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      return toast.error("Amount must be a non-negative number.");
    }
    if (type === "purchase" && !purchaseDate) {
      return toast.error("Purchase date is required.");
    }
    if (type === "rental" && (!rentalStart || !rentalEnd)) {
      return toast.error("Rental start and end dates are required.");
    }

    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          type,
          categoryKey,
          customCategory:
            categoryKey === "other" ? customCategory.trim() : null,
          saveAsResource:
            categoryKey === "other" ? saveAsResource : undefined,
          name: name.trim(),
          description: description.trim() || null,
          quantity: qty,
          amount: cents,
          vendor: vendor.trim() || null,
          assigneeId: assigneeId || null,
          purchaseDate:
            type === "purchase" && purchaseDate
              ? new Date(purchaseDate).toISOString()
              : null,
          rentalStart:
            type === "rental" && rentalStart
              ? new Date(rentalStart).toISOString()
              : null,
          rentalEnd:
            type === "rental" && rentalEnd
              ? new Date(rentalEnd).toISOString()
              : null,
          receiptUrl: receiptUrl.trim() || null,
          paymentStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record purchase.");
        return;
      }
      toast.success("Recorded.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (myDepartments.length === 0) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        setOpen(v);
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Record purchase
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Record a purchase or rental</SheetTitle>
          <SheetDescription>
            Step {step} of 3 ·{" "}
            {step === 1 ? "Type" : step === 2 ? "Category" : "Details"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* ─── Step 1: Type + Dept ─────────────────────────────── */}
            {step === 1 && (
              <>
                {myDepartments.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="dept">Department</Label>
                    <Select
                      value={departmentId}
                      onValueChange={setDepartmentId}
                    >
                      <SelectTrigger id="dept">
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
                  <Label>Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <TypeCard
                      icon={<ShoppingCart className="h-5 w-5" />}
                      title="Purchase"
                      description="Permanent acquisition"
                      selected={type === "purchase"}
                      onClick={() => setType("purchase")}
                    />
                    <TypeCard
                      icon={<Package className="h-5 w-5" />}
                      title="Rental"
                      description="Temporary use"
                      selected={type === "rental"}
                      onClick={() => setType("rental")}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ─── Step 2: Category ────────────────────────────────── */}
            {step === 2 && (
              <>
                <p className="text-xs text-muted-foreground">
                  Pick a category for the {selectedDept?.name} department.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategoryKey(c.key)}
                      className={cn(
                        "text-left rounded-lg border px-3 py-2 text-sm transition",
                        categoryKey === c.key
                          ? "bg-primary/15 border-primary/40 text-primary-foreground"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="font-medium">{c.label}</div>
                      {c.isResource && c.key !== "other" && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Will appear in Resources
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {categoryKey === "other" && (
                  <div className="space-y-3 mt-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="space-y-2">
                      <Label htmlFor="custom-cat">Category name</Label>
                      <Input
                        id="custom-cat"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g., Wireless Boom Batteries"
                        maxLength={120}
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAsResource}
                        onChange={(e) => setSaveAsResource(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 accent-primary"
                      />
                      <span className="text-sm">
                        Save as a Resource (Asset)
                      </span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Toggle on if this is a physical item or file you want
                      to track in the Resources tab.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ─── Step 3: Details ─────────────────────────────────── */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="p-name">Item name</Label>
                  <Input
                    id="p-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={200}
                    placeholder={
                      categoryKey === "other"
                        ? customCategory
                        : selectedCategory?.label
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-desc">Description</Label>
                  <Textarea
                    id="p-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={2000}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="p-qty">Quantity</Label>
                    <Input
                      id="p-qty"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      inputMode="numeric"
                      placeholder="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-amt">Total ({currency})</Label>
                    <Input
                      id="p-amt"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-pay">Payment</Label>
                    <Select
                      value={paymentStatus}
                      onValueChange={(v) =>
                        setPaymentStatus(v as "paid" | "unpaid")
                      }
                    >
                      <SelectTrigger id="p-pay">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-vendor">Vendor / Shop</Label>
                  <Input
                    id="p-vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    maxLength={200}
                  />
                </div>

                {type === "purchase" ? (
                  <div className="space-y-2">
                    <Label htmlFor="p-date">Purchase date</Label>
                    <Input
                      id="p-date"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="p-start">Rental start</Label>
                        <Input
                          id="p-start"
                          type="date"
                          value={rentalStart}
                          onChange={(e) => setRentalStart(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-end">Rental end</Label>
                        <Input
                          id="p-end"
                          type="date"
                          value={rentalEnd}
                          onChange={(e) => setRentalEnd(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    {rentalDays !== null && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {rentalDays}{" "}
                        {rentalDays === 1 ? "day" : "days"}
                      </p>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="p-assignee">Assigned to</Label>
                  <Select
                    value={assigneeId || "_none"}
                    onValueChange={(v) =>
                      setAssigneeId(v === "_none" ? "" : v)
                    }
                  >
                    <SelectTrigger id="p-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-receipt">Receipt URL</Label>
                  <Input
                    id="p-receipt"
                    type="url"
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                    placeholder="https://… (link to scan/photo)"
                    maxLength={800}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Paste a link for now. File upload coming in a later
                    release.
                  </p>
                </div>
              </>
            )}
          </div>

          <SheetFooter className="border-t flex-row gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={back}
                disabled={pending}
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={next} className="gap-2">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save purchase"}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TypeCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition",
        selected
          ? "bg-primary/15 border-primary/40"
          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center",
            selected
              ? "bg-primary/20 text-primary"
              : "bg-white/[0.04] text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <div>
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  );
}
