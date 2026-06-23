"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES } from "@/lib/roles";

interface Props {
  projectId: string;
  isOwner: boolean;
  count: number;
}

const KIND_CHOICES = [
  ...ROLES.map((r) => ({ value: r.value, label: r.label })),
  { value: "custom", label: "Custom" },
];

export function DepartmentsHeader({ projectId, isOwner, count }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            {count === 1
              ? "1 department on this production."
              : `${count} departments on this production.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* V0.21 — Members tab was removed; access through here. */}
        <a
          href={`/projects/${projectId}/members`}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          All members
        </a>
        {isOwner && <CreateDepartmentButton projectId={projectId} />}
      </div>
    </div>
  );
}

function CreateDepartmentButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("custom");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create department.");
        return;
      }
      toast.success(`${data.name} created.`);
      setName("");
      setKind("custom");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New department
        </Button>
      </SheetTrigger>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>New department</SheetTitle>
            <SheetDescription>
              Departments organize people, tasks, notes, and references.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. VFX"
                required
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-kind">Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="dept-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_CHOICES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Used to seed icons and default workspace sections. Pick the
                closest match, or &quot;Custom&quot; if none fit.
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending || !name}>
              {pending ? "Creating…" : "Create department"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
