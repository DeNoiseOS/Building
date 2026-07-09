"use client";

/**
 * V0.24 — Creative approvals panel.
 *
 * Shown on Overview for both sides:
 *   - Production side (Director/AD/Producer/EP/Owner): can request
 *     a new approval + see the queue.
 *   - Client side (Creative Director etc.): sees pending items and
 *     approves/rejects with a reason on rejection.
 * Pending first, then decided.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ClipboardCheck,
  Check,
  X,
} from "lucide-react";

interface Approval {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  requestedBy: { id: string; name: string } | null;
  decidedBy: { id: string; name: string } | null;
  scene: { id: string; number: string; title: string } | null;
}

const KIND_LABELS: Record<string, string> = {
  script_signoff: "Script sign-off",
  treatment: "Treatment",
  casting: "Casting",
  wardrobe: "Wardrobe",
  location: "Location",
  cut_v1: "Cut v1",
  cut_final: "Final cut",
  other: "Other",
};

export function CreativeApprovalsPanel({
  projectId,
  canRequest,
  canDecide,
}: {
  projectId: string;
  /** Director/AD/Producer/EP/Owner side. */
  canRequest: boolean;
  /** Agency roles. */
  canDecide: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Approval[] | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch(
        `/api/projects/${projectId}/creative-approvals`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({ approvals: [] }));
      if (!cancel) setRows(data.approvals ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  async function refresh() {
    const res = await fetch(
      `/api/projects/${projectId}/creative-approvals`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({ approvals: [] }));
    setRows(data.approvals ?? []);
    router.refresh();
  }

  const sorted = rows
    ? [...rows].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return b.requestedAt.localeCompare(a.requestedAt);
      })
    : [];

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Creative approvals</h2>
        <span className="text-xs text-muted-foreground">
          {rows?.filter((r) => r.status === "pending").length ?? 0}{" "}
          pending
        </span>
        {canRequest && (
          <div className="ml-auto">
            <RequestButton projectId={projectId} onDone={refresh} />
          </div>
        )}
      </div>
      <div className="p-5 space-y-2">
        {rows === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No approvals yet.
          </p>
        ) : (
          sorted.map((a) => (
            <ApprovalRow
              key={a.id}
              projectId={projectId}
              approval={a}
              canDecide={canDecide}
              onDone={refresh}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ApprovalRow({
  projectId,
  approval,
  canDecide,
  onDone,
}: {
  projectId: string;
  approval: Approval;
  canDecide: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function decide(decision: "approved" | "rejected", why: string | null = null) {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/creative-approvals/${approval.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason: why }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success(decision === "approved" ? "Approved." : "Rejected.");
      onDone();
    });
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
          {KIND_LABELS[approval.kind] ?? approval.kind}
        </Badge>
        {approval.scene && (
          <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
            Scene #{approval.scene.number}
          </Badge>
        )}
        {approval.status === "pending" && (
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300"
          >
            Pending
          </Badge>
        )}
        {approval.status === "approved" && (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          >
            Approved
          </Badge>
        )}
        {approval.status === "rejected" && (
          <Badge
            variant="outline"
            className="text-[10px] bg-red-500/10 border-red-500/30 text-red-300"
          >
            Rejected
          </Badge>
        )}
        <div className="text-sm font-medium">{approval.title}</div>
      </div>
      {approval.description && (
        <p className="text-xs text-muted-foreground mt-1">
          {approval.description}
        </p>
      )}
      <div className="mt-1 text-[11px] text-muted-foreground">
        Requested by {approval.requestedBy?.name ?? "—"}
        {approval.decidedBy && (
          <>
            {" "}· {approval.status} by {approval.decidedBy.name}
          </>
        )}
      </div>
      {approval.decisionReason && (
        <p className="mt-1.5 text-xs italic text-foreground/85">
          &ldquo;{approval.decisionReason}&rdquo;
        </p>
      )}
      {canDecide && approval.status === "pending" && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => decide("approved")}
            disabled={pending}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Sheet open={rejectOpen} onOpenChange={setRejectOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={pending}
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle>Reject &ldquo;{approval.title}&rdquo;</SheetTitle>
                <SheetDescription>
                  Give a short reason. The production team will see this.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 px-5 py-4">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="e.g. Casting doesn't fit the brand tone. Prefer a warmer read."
                />
              </div>
              <SheetFooter>
                <Button
                  variant="destructive"
                  disabled={pending || reason.trim().length < 3}
                  onClick={() => {
                    decide("rejected", reason.trim());
                    setRejectOpen(false);
                    setReason("");
                  }}
                >
                  Confirm reject
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}

function RequestButton({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState("script_signoff");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title required.");
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/creative-approvals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            title: title.trim(),
            description: description.trim() || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Approval requested.");
      setTitle("");
      setDescription("");
      setOpen(false);
      onDone();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />
          Request
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Request creative approval</SheetTitle>
            <SheetDescription>
              Sent to the agency team on this project.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g. Casting picks — 3 leads"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Context, links, and what you need signed off."
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
