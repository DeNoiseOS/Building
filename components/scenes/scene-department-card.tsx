"use client";

/**
 * V0.17 — Per-department workspace card on the scene detail page.
 *
 * Renders enable toggle (for scene authors), workspace fields
 * (requirements / notes), status select, and the approve action.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Clock } from "lucide-react";
import { SCENE_DEPT_STATUS } from "@/lib/scene-data";

export interface SceneDeptRow {
  id?: string;
  departmentId: string;
  departmentName: string;
  enabled: boolean;
  status: string;
  approvalStatus: string;
  requirements: string | null;
  notes: string | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
}

export function SceneDepartmentCard({
  projectId,
  sceneId,
  row,
  canToggle,
  canEdit,
  canApprove,
}: {
  projectId: string;
  sceneId: string;
  row: SceneDeptRow;
  canToggle: boolean;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requirements, setRequirements] = useState(row.requirements ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [status, setStatus] = useState(row.status);

  function patch(payload: Record<string, unknown>) {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/departments/${row.departmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  }

  function toggleEnabled() {
    patch({ enabled: !row.enabled });
  }

  function saveWorkspace() {
    patch({
      requirements: requirements.trim() || null,
      notes: notes.trim() || null,
      status,
    });
  }

  function approve() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/departments/${row.departmentId}/approve`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to approve.");
        return;
      }
      toast.success("Approved.");
      router.refresh();
    });
  }

  return (
    <section
      className={`rounded-2xl border shadow-soft ${
        row.enabled
          ? "bg-card/60 border-white/[0.06]"
          : "bg-white/[0.02] border-dashed border-white/[0.06] opacity-70"
      }`}
    >
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold">{row.departmentName}</h3>
          {row.enabled ? (
            <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
              Active on scene
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-white/[0.02]">
              Disabled
            </Badge>
          )}
          {row.enabled && row.approvalStatus === "approved" && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-300 gap-1"
            >
              <Check className="h-3 w-3" /> Approved
              {row.approvedBy ? ` · ${row.approvedBy.name}` : ""}
            </Badge>
          )}
          {row.enabled &&
            row.status === "completed" &&
            row.approvalStatus !== "approved" && (
              <Badge
                variant="outline"
                className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300 gap-1"
              >
                <Clock className="h-3 w-3" /> Awaiting approval
              </Badge>
            )}
        </div>
        {canToggle && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleEnabled}
            disabled={pending}
          >
            {row.enabled ? "Disable" : "Enable"}
          </Button>
        )}
      </div>

      {row.enabled && (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Requirements</Label>
              <Textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={3}
                placeholder="What does this department need for this scene?"
                disabled={!canEdit}
                maxLength={4000}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything else worth recording."
                disabled={!canEdit}
                maxLength={4000}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENE_DEPT_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button size="sm" onClick={saveWorkspace} disabled={pending}>
                  Save
                </Button>
              )}
              {canApprove &&
                row.status === "completed" &&
                row.approvalStatus !== "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-300 hover:text-emerald-200"
                    onClick={approve}
                    disabled={pending}
                  >
                    Approve
                  </Button>
                )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
