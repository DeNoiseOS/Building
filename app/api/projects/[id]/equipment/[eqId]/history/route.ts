import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";

/**
 * V0.16 — Asset history.
 *
 * Returns a chronological timeline derived from existing tables:
 *   - Equipment.createdAt        → "created"
 *   - Equipment.purchaseDate     → "purchased" (when set)
 *   - EquipmentAssignment events → "assigned" / "returned"
 *   - DamageReport events        → "damaged" / "under_review" / "resolved"
 *   - MaintenanceRecord events   → "maintenance_started" / "maintenance_completed"
 *
 * No new model needed — pure derivation.
 */

type HistoryEvent = {
  at: string;
  kind:
    | "created"
    | "purchased"
    | "assigned"
    | "returned"
    | "damaged"
    | "under_review"
    | "resolved"
    | "maintenance_started"
    | "maintenance_completed";
  label: string;
  actor?: { id: string; name: string } | null;
  detail?: string | null;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; eqId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  try {
    const eq = await prisma.equipment.findFirst({
      where: { id: eqId, projectId: id },
      include: {
        assignments: {
          orderBy: { assignedAt: "asc" },
          include: {
            assignedTo: { select: { id: true, name: true } },
            assignedBy: { select: { id: true, name: true } },
            returnedBy: { select: { id: true, name: true } },
            assignedToDepartment: { select: { id: true, name: true } },
          },
        },
        damageReports: {
          orderBy: { createdAt: "asc" },
          include: { reportedBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!eq) return notFound("Equipment not found.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mModel = (prisma as any).maintenanceRecord;
    const maintenance = mModel
      ? await mModel
          .findMany({
            where: { equipmentId: eqId },
            orderBy: { startedAt: "asc" },
            include: { createdBy: { select: { id: true, name: true } } },
          })
          .catch(() => [])
      : [];

    const events: HistoryEvent[] = [];

    events.push({
      at: eq.createdAt.toISOString(),
      kind: "created",
      label: `Asset created — '${eq.name}'`,
    });

    if (eq.purchaseDate) {
      events.push({
        at: eq.purchaseDate.toISOString(),
        kind: "purchased",
        label: `Purchased${
          eq.purchaseCost
            ? ` for ${(eq.purchaseCost / 100).toLocaleString()}`
            : ""
        }`,
      });
    }

    for (const a of eq.assignments) {
      const targetLabel =
        a.assignedTo?.name ??
        (a.assignedToDepartment
          ? `${a.assignedToDepartment.name} (dept)`
          : "Unknown");
      events.push({
        at: a.assignedAt.toISOString(),
        kind: "assigned",
        label: `Checked out to ${targetLabel}`,
        actor: a.assignedBy ?? null,
        detail: a.notes ?? null,
      });
      if (a.returnedAt) {
        events.push({
          at: a.returnedAt.toISOString(),
          kind: "returned",
          label: `Returned${
            a.returnCondition ? ` (${a.returnCondition})` : ""
          }`,
          actor: a.returnedBy ?? a.assignedTo ?? null,
        });
      }
    }

    for (const r of eq.damageReports) {
      events.push({
        at: r.createdAt.toISOString(),
        kind: "damaged",
        label: `Damage reported (${r.severity})`,
        actor: r.reportedBy,
        detail: r.description,
      });
      if (r.status === "under_review") {
        events.push({
          at: r.createdAt.toISOString(),
          kind: "under_review",
          label: "Damage report under review",
        });
      }
      if (r.resolvedAt) {
        events.push({
          at: r.resolvedAt.toISOString(),
          kind: "resolved",
          label: "Damage resolved",
          detail: r.resolution ?? null,
        });
      }
    }

    type MaintenanceRow = {
      startedAt: Date;
      completedAt: Date | null;
      type: string;
      vendor: string | null;
      cost: number | null;
      createdBy: { id: string; name: string };
    };
    for (const m of maintenance as MaintenanceRow[]) {
      events.push({
        at: m.startedAt.toISOString(),
        kind: "maintenance_started",
        label: `Maintenance started (${m.type})`,
        actor: m.createdBy,
        detail: m.vendor,
      });
      if (m.completedAt) {
        events.push({
          at: m.completedAt.toISOString(),
          kind: "maintenance_completed",
          label: `Maintenance completed${
            m.cost ? ` — ${(m.cost / 100).toLocaleString()}` : ""
          }`,
        });
      }
    }

    events.sort((a, b) => a.at.localeCompare(b.at));

    return NextResponse.json({ history: events });
  } catch (err) {
    console.error("[equipment.history]", err);
    return serverError("Failed to load history.");
  }
}
