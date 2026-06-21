"use client";

/**
 * V0.14.4 — Edit a pending purchase.
 *
 * Used by the creator (member) to fix mistakes after submission.
 * Only the fields server-side accepts for pending creator edits:
 * name, amount, quantity, vendor, description, categoryKey,
 * customCategory, receiptUrl. The dept/type are fixed at creation —
 * to change those, delete + recreate.
 */

import { useState, useTransition } from "react";
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

export interface PendingPurchaseEdit {
  id: string;
  name: string;
  amount: number;
  quantity: number;
  vendor: string | null;
  description: string | null;
  receiptUrl: string | null;
}

export function PendingPurchaseEditSheet({
  open,
  onOpenChange,
  projectId,
  currency,
  purchase,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  currency: string;
  purchase: PendingPurchaseEdit;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(purchase.name);
  const [quantity, setQuantity] = useState(String(purchase.quantity));
  const [amount, setAmount] = useState(String(purchase.amount / 100));
  const [vendor, setVendor] = useState(purchase.vendor ?? "");
  const [description, setDescription] = useState(purchase.description ?? "");
  const [receiptUrl, setReceiptUrl] = useState(purchase.receiptUrl ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.round(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return toast.error("Quantity must be at least 1.");
    }
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      return toast.error("Amount must be a non-negative number.");
    }
    if (!name.trim()) return toast.error("Name is required.");
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/purchases/${purchase.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            amount: cents,
            quantity: qty,
            vendor: vendor.trim() || null,
            description: description.trim() || null,
            receiptUrl: receiptUrl.trim() || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      toast.success("Purchase updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <form onSubmit={save} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Edit pending purchase</SheetTitle>
            <SheetDescription>
              You can edit this while it&apos;s pending approval. After
              your head approves or rejects, it locks.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pe-name">Item name</Label>
              <Input
                id="pe-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pe-qty">Quantity</Label>
                <Input
                  id="pe-qty"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-amt">Total ({currency})</Label>
                <Input
                  id="pe-amt"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-vendor">Vendor</Label>
              <Input
                id="pe-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-desc">Description</Label>
              <Textarea
                id="pe-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-receipt">Receipt URL</Label>
              <Input
                id="pe-receipt"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                type="url"
                placeholder="https://…"
                maxLength={800}
              />
              <p className="text-[11px] text-muted-foreground">
                Add, replace, or clear the receipt while pending.
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
