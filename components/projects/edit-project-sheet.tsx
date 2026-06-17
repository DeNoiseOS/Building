"use client";

import { useEffect, useState } from "react";
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

interface EditProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
  };
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export function EditProjectSheet({
  open,
  onOpenChange,
  project,
}: EditProjectSheetProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [startDate, setStartDate] = useState(toDateInput(project.startDate));
  const [endDate, setEndDate] = useState(toDateInput(project.endDate));
  const [loading, setLoading] = useState(false);

  // Reset form fields if the sheet is reopened against a freshly-loaded project.
  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setStartDate(toDateInput(project.startDate));
      setEndDate(toDateInput(project.endDate));
    }
  }, [open, project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must be on or after the start date.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to update project.");
      return;
    }

    toast.success("Project updated.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit project</SheetTitle>
          <SheetDescription>Update the production&apos;s details.</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col gap-5 px-4 overflow-y-auto"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-name">Project name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start date</Label>
              <Input
                id="edit-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">End date</Label>
              <Input
                id="edit-end"
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
            {loading ? "Saving..." : "Save changes"}
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
