"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserPlus,
  CornerDownLeft,
  AlertTriangle,
  CheckCircle2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT_STATUS_LABELS,
  DAMAGE_SEVERITY,
  DAMAGE_SEVERITY_LABELS,
} from "@/lib/equipment-status";

interface User {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  assignedTo: User;
  assignedBy: User;
  assignedAt: string;
  returnedAt: string | null;
  notes?: string | null;
}

interface DamageReport {
  id: string;
  reportedBy: User;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

interface Props {
  projectId: string;
  equipmentId: string;
  name: string;
  status: string;
  notes: string | null;
  canManage: boolean;
  canFileDamage: boolean;
  currentUserId: string;
  openAssignment: Assignment | null;
  assignments: Assignment[];
  damageReports: DamageReport[];
  members: User[];
}

const STATUS_PILL: Record<string, string> = {
  available: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  checked_out: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  returned: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  damaged: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  lost: "border-red-400/25 bg-red-400/10 text-red-300",
};

const SEVERITY_PILL: Record<string, string> = {
  low: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  medium: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  high: "border-orange-400/25 bg-orange-400/10 text-orange-200",
  critical: "border-red-400/25 bg-red-400/10 text-red-300",
};

function relative(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function EquipmentDetailPanel({
  projectId,
  equipmentId,
  status,
  notes,
  canManage,
  canFileDamage,
  currentUserId,
  openAssignment,
  assignments,
  damageReports,
  members,
}: Props) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function returnEquipment() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/equipment/${equipmentId}/return`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Returned.");
      router.refresh();
    });
  }

  async function resolveDamage(drId: string) {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/equipment/${equipmentId}/damage-reports/${drId}/resolve`,
        { method: "POST" }
      );
      if (!res.ok) {
        toast.error("Failed.");
        return;
      }
      toast.success("Resolved.");
      router.refresh();
    });
  }

  const canReturnOpen =
    openAssignment !== null &&
    (canManage || openAssignment.assignedTo.id === currentUserId);

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={STATUS_PILL[status]}>
            {EQUIPMENT_STATUS_LABELS[status] ?? status}
          </Badge>
          {openAssignment && (
            <span className="text-sm text-muted-foreground">
              With{" "}
              <span className="text-foreground font-medium">
                {openAssignment.assignedTo.name}
              </span>{" "}
              since {relative(openAssignment.assignedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && !openAssignment && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setAssignOpen(true)}
              disabled={pending}
            >
              <UserPlus className="h-4 w-4" />
              Assign
            </Button>
          )}
          {canReturnOpen && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={returnEquipment}
              disabled={pending}
            >
              <CornerDownLeft className="h-4 w-4" />
              Return
            </Button>
          )}
          {canFileDamage && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-amber-200 hover:text-amber-100"
              onClick={() => setDamageOpen(true)}
            >
              <AlertTriangle className="h-4 w-4" />
              Report damage
            </Button>
          )}
        </div>
      </div>

      {notes && (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] p-5 text-sm whitespace-pre-wrap">
          {notes}
        </div>
      )}

      {/* Damage reports */}
      {damageReports.length > 0 && (
        <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Damage reports
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                ({damageReports.length})
              </span>
            </h2>
          </div>
          <ol className="divide-y divide-white/[0.04]">
            {damageReports.map((d) => (
              <li
                key={d.id}
                className="px-5 py-3 flex items-start gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={SEVERITY_PILL[d.severity]}
                    >
                      {DAMAGE_SEVERITY_LABELS[d.severity] ?? d.severity}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        d.status === "resolved"
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                          : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                      }
                    >
                      {d.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {d.reportedBy.name} · {relative(d.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap">
                    {d.description}
                  </p>
                  {d.resolution && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Resolution: {d.resolution}
                    </p>
                  )}
                </div>
                {canManage && d.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={pending}
                    onClick={() => resolveDamage(d.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolve
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Assignment history */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Assignment history
          </h2>
        </div>
        {assignments.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Not assigned yet.
          </div>
        ) : (
          <ol className="divide-y divide-white/[0.04]">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="px-5 py-3 flex items-center gap-3 text-sm"
              >
                <span className="font-medium">{a.assignedTo.name}</span>
                <span className="text-muted-foreground text-xs">
                  by {a.assignedBy.name} · {relative(a.assignedAt)}
                  {a.returnedAt
                    ? ` → returned ${relative(a.returnedAt)}`
                    : " · open"}
                </span>
                {!a.returnedAt && (
                  <Badge
                    variant="outline"
                    className="ml-auto border-sky-400/25 bg-sky-400/10 text-sky-300 text-[10px]"
                  >
                    Current
                  </Badge>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {assignOpen && (
        <AssignSheet
          open={assignOpen}
          onOpenChange={setAssignOpen}
          projectId={projectId}
          equipmentId={equipmentId}
          members={members}
        />
      )}
      {damageOpen && (
        <DamageSheet
          open={damageOpen}
          onOpenChange={setDamageOpen}
          projectId={projectId}
          equipmentId={equipmentId}
        />
      )}
    </div>
  );
}

function AssignSheet({
  open,
  onOpenChange,
  projectId,
  equipmentId,
  members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  equipmentId: string;
  members: User[];
}) {
  const router = useRouter();
  const [assignedToUserId, setAssignedToUserId] = useState(
    members[0]?.id ?? ""
  );
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignedToUserId) {
      toast.error("Pick a user.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/equipment/${equipmentId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignedToUserId,
            notes: notes.trim() || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Assigned.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Assign equipment</SheetTitle>
            <SheetDescription>
              The holder receives a notification.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={assignedToUserId}
                onValueChange={setAssignedToUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Assigning…" : "Assign"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DamageSheet({
  open,
  onOpenChange,
  projectId,
  equipmentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  equipmentId: string;
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("low");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Describe the damage.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/equipment/${equipmentId}/damage-reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim(),
            severity,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Reported.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Report damage</SheetTitle>
            <SheetDescription>
              Producer + department head are notified. High / critical flips
              status to Damaged.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_SEVERITY.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                required
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Report"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

void cn; // imported but kept available for inline cn() additions
