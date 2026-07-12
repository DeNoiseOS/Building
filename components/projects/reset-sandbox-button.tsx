"use client";

/**
 * V0.26.3 — Reset button for the Full Fledge sandbox.
 *
 * Only rendered by the server layout when:
 *   - NEXT_PUBLIC_QUICK_LOGIN=1
 *   - the current project is the sandbox
 *   - the caller's project role is "producer"
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw } from "lucide-react";

export function ResetSandboxButton({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/reset`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Reset failed.");
        return;
      }
      toast.success("Sandbox reset.");
      setOpen(false);
      router.push(`/projects/${projectId}`);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset sandbox
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset the sandbox project?</AlertDialogTitle>
          <AlertDialogDescription>
            This wipes <strong>everything</strong> inside the Full Fledge
            sandbox: scenes, cast, purchases, budget, resources, bible
            entries, attachments, tasks, activity, and every member
            (except the owner). Other role personas will re-attach the
            next time they sign in.
            <br />
            <br />
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            disabled={pending}
            className="bg-amber-600 text-white hover:bg-amber-500"
          >
            {pending ? "Resetting…" : "Yes, reset it"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
