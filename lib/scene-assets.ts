import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.18 — Scene asset helpers.
 *
 * Inventory math:
 *   - Each Equipment row has a `quantity` (total owned/rented).
 *   - SceneAsset rows represent demand per scene.
 *   - For a single equipment, "demand" = sum(quantityNeeded) across
 *     ALL SceneAsset rows. There's no time-of-day overlap modeling
 *     yet — that arrives with Scheduling (a Scene only "consumes" the
 *     asset during its shoot day). For now, demand is total bookings.
 *   - Shortage = max(0, demand − quantity). Surfaced as a warning,
 *     never blocks the link.
 */

export interface SceneAssetEntry {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: string | null;
  inventoryQuantity: number;
  quantityNeeded: number;
  notes: string | null;
  addedBy: { id: string; name: string } | null;
  /** Sum of all scenes' demand on this equipment (incl. this row). */
  totalDemand: number;
  /** max(0, totalDemand - inventory). */
  shortage: number;
}

export async function getSceneAssetsForDepartment(params: {
  sceneId: string;
  departmentId: string;
}): Promise<SceneAssetEntry[]> {
  const { sceneId, departmentId } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sa = (prisma as any).sceneAsset;
  if (!sa) return [];

  const rows = await sa.findMany({
    where: { sceneId, equipment: { departmentId } },
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          category: true,
          quantity: true,
        },
      },
      addedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) return [];

  // Aggregate demand across all scenes for the equipment ids we touch.
  const equipmentIds = Array.from(
    new Set(
      (rows as Array<{ equipmentId: string }>).map((r) => r.equipmentId)
    )
  );
  const demandRows = await sa.groupBy({
    by: ["equipmentId"],
    where: { equipmentId: { in: equipmentIds } },
    _sum: { quantityNeeded: true },
  });
  const demandMap = new Map<string, number>();
  for (const d of demandRows as Array<{
    equipmentId: string;
    _sum: { quantityNeeded: number | null };
  }>) {
    demandMap.set(d.equipmentId, d._sum.quantityNeeded ?? 0);
  }

  type Row = {
    id: string;
    equipmentId: string;
    quantityNeeded: number;
    notes: string | null;
    equipment: {
      id: string;
      name: string;
      category: string | null;
      quantity: number;
    };
    addedBy: { id: string; name: string } | null;
  };
  return (rows as Row[]).map((r) => {
    const totalDemand = demandMap.get(r.equipmentId) ?? r.quantityNeeded;
    const shortage = Math.max(0, totalDemand - r.equipment.quantity);
    return {
      id: r.id,
      equipmentId: r.equipmentId,
      equipmentName: r.equipment.name,
      equipmentCategory: r.equipment.category,
      inventoryQuantity: r.equipment.quantity,
      quantityNeeded: r.quantityNeeded,
      notes: r.notes,
      addedBy: r.addedBy,
      totalDemand,
      shortage,
    };
  });
}

/** Scenes that reference a given Equipment, with per-scene demand. */
export async function getScenesUsingEquipment(equipmentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sa = (prisma as any).sceneAsset;
  if (!sa) return [];
  const rows = await sa.findMany({
    where: { equipmentId },
    include: {
      scene: {
        select: { id: true, number: true, title: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  type R = {
    id: string;
    quantityNeeded: number;
    notes: string | null;
    scene: { id: string; number: string; title: string; status: string };
  };
  return (rows as R[]).map((r) => ({
    sceneAssetId: r.id,
    quantityNeeded: r.quantityNeeded,
    notes: r.notes,
    scene: r.scene,
  }));
}
