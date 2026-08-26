"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { createShootDayAction } from "@/lib/scheduling/actions";

/**
 * V0.29 — "New Shoot Day" trigger + sheet.
 *
 * The Scheduling page's primary CTA. Collects date + optional label +
 * general call time + location; the rest of the metadata is filled in
 * from the shoot-day editor.
 */
export function NewShootDayButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState("");
  const [generalCallTime, setGeneralCallTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await createShootDayAction({
        projectId,
        date,
        label: label.trim() || undefined,
        generalCallTime: generalCallTime.trim() || undefined,
        locationName: locationName.trim() || undefined,
      });
      toast.success("Shoot day created");
      setOpen(false);
      router.push(`/projects/${projectId}/scheduling/${result.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't create shoot day";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        New Shoot Day
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[420px] sm:max-w-[420px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
        >
          <SheetHeader className="border-b border-[var(--denoise-border)]">
            <SheetTitle className="text-[var(--denoise-cream)]">
              New Shoot Day
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[var(--denoise-cream-muted)]">
              You can fill the full call-sheet details after creating.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} className="p-4 space-y-4 text-[13px]">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
                Date
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
                Label (optional)
              </Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Day 3 of 12"
                className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
                General Call Time
              </Label>
              <Input
                type="time"
                value={generalCallTime}
                onChange={(e) => setGeneralCallTime(e.target.value)}
                className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
                Location
              </Label>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Warehouse 4, Al Malqa"
                className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </div>
            <div className="pt-3 border-t border-[var(--denoise-border)] flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9"
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
              >
                Create
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
