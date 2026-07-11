"use client";

/**
 * V0.26.1 — Testing-mode "Add teammate" button.
 *
 * Skips the invite → email → accept flow entirely. Manager picks a
 * role, and the corresponding shared persona is attached to the
 * project immediately. Only rendered when NEXT_PUBLIC_QUICK_LOGIN=1.
 */

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
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GroupedRolePicker } from "@/components/shared/grouped-role-picker";
import { Zap } from "lucide-react";

export function AddPersonaButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [allowed, setAllowed] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      const res = await fetch(`/api/projects/${projectId}/invitable-roles`);
      const data = await res.json().catch(() => ({ roles: [] }));
      if (!cancel) {
        const list: { value: string }[] = data.roles ?? [];
        setAllowed(list.map((r) => r.value));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, projectId]);

  function add() {
    if (!role) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/members/add-persona`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add.");
        return;
      }
      toast.success(data.alreadyMember ? "Already a member." : "Added.");
      setOpen(false);
      setRole("");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Zap className="h-4 w-4" />
          Add teammate
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Add teammate</SheetTitle>
          <SheetDescription>
            Skips the invitation dance. Picks the shared persona for
            the role and attaches them to this project immediately.
            Only available in testing mode.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <GroupedRolePicker
            value={role}
            onChange={setRole}
            availableRoles={allowed}
          />
        </div>
        <SheetFooter>
          <Button onClick={add} disabled={pending || !role}>
            {pending ? "Adding…" : "Add teammate"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
