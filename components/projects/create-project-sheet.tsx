"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { type Role } from "@/lib/roles";
import { CurrencySelect } from "@/components/shared/currency-select";
import { GroupedRolePicker } from "@/components/shared/grouped-role-picker";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

interface CreateProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectSheet({
  open,
  onOpenChange,
}: CreateProjectSheetProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<Role>("director");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setRole("director");
    setStartDate("");
    setEndDate("");
    setCurrency(DEFAULT_CURRENCY);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please provide start and end dates.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must be on or after the start date.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        role,
        currency,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to create project.");
      return;
    }

    const created = await res.json();
    toast.success(`Created '${created.name}'`);
    reset();
    onOpenChange(false);
    router.push(`/projects/${created.id}`);
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>New Project</SheetTitle>
          <SheetDescription>
            Start tracking a production. You can edit any of these details later.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col gap-5 px-4 overflow-y-auto"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Untitled Feature Film"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this production?"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>My role</Label>
            <GroupedRolePicker
              value={role}
              onChange={(r) => setRole(r as Role)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Project currency</Label>
            <CurrencySelect
              id="currency"
              value={currency}
              onChange={setCurrency}
            />
            <p className="text-xs text-muted-foreground">
              All budgets, custodies, and expenses on this project use this currency.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End date</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
        </form>

        <SheetFooter className="border-t">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Project"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
