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
import {
  Plus,
  ShoppingCart,
  Package,
  ChevronRight,
  Trash2,
  Wand2,
} from "lucide-react";
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
  /** Departments the caller is allowed to record for. */
  myDepartments: DeptOption[];
  /** Map of departmentKey → purchase categories. */
  purchaseCategoriesByDept: Record<string, Category[]>;
  /** Map of departmentKey → rental categories. */
  rentalCategoriesByDept: Record<string, Category[]>;
  /** Project members eligible to be assignees (heads only — members can only assign to self). */
  members: MemberOption[];
  /** Project's currency (e.g., "SAR"). Display only. */
  currency: string;
  /** Optional pre-selected dept (when opened from a dept page). */
  defaultDepartmentId?: string;
  /** Custom trigger; defaults to a primary button labelled "Record purchase". */
  trigger?: React.ReactNode;
  /**
   * V0.14.1 — when true, caller is a plain dept member (not a head).
   * Sheet locks assignee to self and shows a banner about which
   * custody the purchase will deduct from.
   */
  callerIsMember?: boolean;
  /** Display name of the caller (for the locked-assignee chip). */
  callerName?: string;
  /**
   * Open custodies the caller holds, keyed by department id. Used to
   * show "Recording against custody: 4,500 SAR remaining of 5,000".
   */
  callerCustodyByDept?: Record<
    string,
    { id: string; amount: number; remaining: number }
  >;
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
  callerIsMember = false,
  callerName = "you",
  callerCustodyByDept = {},
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
  /** V0.22 — multi-line items. Always has at least one row. */
  const [items, setItems] = useState<
    Array<{ name: string; quantity: string; unitPrice: string; lineTotal: string }>
  >([{ name: "", quantity: "1", unitPrice: "", lineTotal: "" }]);
  /** Total amount in display units (currency, not cents). Auto-fills
   * from items sum but the user can override (tax, discount). */
  const [amount, setAmount] = useState("");
  /** True while the user hasn't manually touched the total field —
   * lets us keep amount in sync with items. Cleared on manual edit. */
  const [amountAuto, setAmountAuto] = useState(true);
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
    setItems([{ name: "", quantity: "1", unitPrice: "", lineTotal: "" }]);
    setAmount("");
    setAmountAuto(true);
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

  // V0.22 — auto-keep the total in sync with item sums while the user
  // hasn't manually overridden it.
  useEffect(() => {
    if (!amountAuto) return;
    const sum = items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
    setAmount(sum > 0 ? sum.toFixed(2) : "");
  }, [items, amountAuto]);

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
    if (!name.trim()) return toast.error("Invoice title is required.");

    // V0.22 — validate items.
    const cleanItems = items
      .map((it) => ({
        name: it.name.trim(),
        quantity: Math.round(Number(it.quantity)),
        unitPrice:
          it.unitPrice.trim() === ""
            ? null
            : Math.round(Number(it.unitPrice) * 100),
        lineTotal: Math.round(Number(it.lineTotal) * 100),
      }))
      .filter((it) => it.name.length > 0);
    if (cleanItems.length === 0) {
      return toast.error("Add at least one item.");
    }
    for (const it of cleanItems) {
      if (!Number.isFinite(it.quantity) || it.quantity < 1) {
        return toast.error(`"${it.name}" — quantity must be at least 1.`);
      }
      if (!Number.isFinite(it.lineTotal) || it.lineTotal < 0) {
        return toast.error(`"${it.name}" — line total is required.`);
      }
      if (
        it.unitPrice !== null &&
        (!Number.isFinite(it.unitPrice) || it.unitPrice < 0)
      ) {
        return toast.error(`"${it.name}" — unit price is invalid.`);
      }
    }

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      return toast.error("Total must be a non-negative number.");
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
          quantity: cleanItems.reduce((s, i) => s + i.quantity, 0),
          amount: cents,
          // V0.22 — line items.
          items: cleanItems,
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
                  <Label htmlFor="p-name">Invoice title</Label>
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
                  <p className="text-[11px] text-muted-foreground">
                    A short title for the whole receipt (e.g. &quot;IKEA
                    props run — Thursday&quot;).
                  </p>
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

                {/* V0.22 — Items on the invoice */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Items on this invoice</Label>
                    <span className="text-[11px] text-muted-foreground">
                      {items.length}{" "}
                      {items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      <div className="col-span-5">Name</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1"></div>
                    </div>
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
                      >
                        <Input
                          className="col-span-5 h-8"
                          value={it.name}
                          onChange={(e) =>
                            setItems((cur) =>
                              cur.map((r, i) =>
                                i === idx ? { ...r, name: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Item name"
                          maxLength={200}
                        />
                        <Input
                          className="col-span-2 h-8 text-right"
                          inputMode="numeric"
                          value={it.quantity}
                          onChange={(e) => {
                            const v = e.target.value;
                            setItems((cur) =>
                              cur.map((r, i) => {
                                if (i !== idx) return r;
                                const next = { ...r, quantity: v };
                                // Auto-fill lineTotal when both qty + unit exist.
                                const q = Number(v);
                                const u = Number(r.unitPrice);
                                if (
                                  Number.isFinite(q) &&
                                  q > 0 &&
                                  Number.isFinite(u) &&
                                  r.unitPrice.trim() !== ""
                                ) {
                                  next.lineTotal = (q * u).toFixed(2);
                                }
                                return next;
                              })
                            );
                          }}
                          placeholder="1"
                        />
                        <Input
                          className="col-span-2 h-8 text-right"
                          inputMode="decimal"
                          value={it.unitPrice}
                          onChange={(e) => {
                            const v = e.target.value;
                            setItems((cur) =>
                              cur.map((r, i) => {
                                if (i !== idx) return r;
                                const next = { ...r, unitPrice: v };
                                const q = Number(r.quantity);
                                const u = Number(v);
                                if (
                                  Number.isFinite(q) &&
                                  q > 0 &&
                                  Number.isFinite(u) &&
                                  v.trim() !== ""
                                ) {
                                  next.lineTotal = (q * u).toFixed(2);
                                }
                                return next;
                              })
                            );
                          }}
                          placeholder="opt."
                        />
                        <Input
                          className="col-span-2 h-8 text-right"
                          inputMode="decimal"
                          value={it.lineTotal}
                          onChange={(e) =>
                            setItems((cur) =>
                              cur.map((r, i) =>
                                i === idx
                                  ? { ...r, lineTotal: e.target.value }
                                  : r
                              )
                            )
                          }
                          placeholder="0"
                        />
                        <button
                          type="button"
                          className="col-span-1 h-8 inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setItems((cur) =>
                              cur.length === 1
                                ? cur
                                : cur.filter((_, i) => i !== idx)
                            )
                          }
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80"
                    onClick={() =>
                      setItems((cur) => [
                        ...cur,
                        {
                          name: "",
                          quantity: "1",
                          unitPrice: "",
                          lineTotal: "",
                        },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" />
                    Add item
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    Unit price is optional. Line total is required. Each
                    item with a resource category becomes its own asset in
                    Resources.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2 col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="p-amt">
                        Invoice total ({currency})
                      </Label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
                        onClick={() => {
                          const sum = items.reduce(
                            (s, it) => s + (Number(it.lineTotal) || 0),
                            0
                          );
                          setAmount(sum.toFixed(2));
                          setAmountAuto(true);
                        }}
                      >
                        <Wand2 className="h-3 w-3" />
                        Auto-fill from items
                      </button>
                    </div>
                    <Input
                      id="p-amt"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setAmountAuto(false);
                      }}
                      inputMode="decimal"
                      placeholder="0"
                      required
                    />
                    {amountAuto && (
                      <p className="text-[11px] text-muted-foreground">
                        Override above to add tax or discount.
                      </p>
                    )}
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
                  {callerIsMember ? (
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-muted-foreground">
                      {callerName} (you)
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300/70">
                        members can only assign to themselves
                      </span>
                    </div>
                  ) : (
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
                  )}
                </div>
                {callerIsMember && departmentId && callerCustodyByDept[departmentId] && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
                    <div className="font-medium text-primary-foreground">
                      Recording against your custody
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {(callerCustodyByDept[departmentId].remaining / 100).toLocaleString()} {currency} remaining of {(callerCustodyByDept[departmentId].amount / 100).toLocaleString()} {currency}
                    </div>
                  </div>
                )}
                {callerIsMember && departmentId && !callerCustodyByDept[departmentId] && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    You don&apos;t have an active custody for this department. Ask your department head to issue one, or request additional custody.
                  </div>
                )}

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
