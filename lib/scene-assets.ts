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
  /** V0.31 — per-scene asset-type override; falls back to the
   *  Equipment's default assetType when null. */
  assetTypeOverride: string | null;
  /** V0.31 — the Equipment's default assetType (item-level default). */
  equipmentAssetType: string | null;
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

  const rows = await prisma.sceneAsset.findMany({
    where: { sceneId, equipment: { departmentId } },
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          category: true,
          quantity: true,
          assetType: true,
        },
      },
      addedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) return [];

  // Aggregate demand across all scenes for the equipment ids we touch.
  const equipmentIds = Array.from(new Set(rows.map((r) => r.equipmentId)));
  const demandRows = await prisma.sceneAsset.groupBy({
    by: ["equipmentId"],
    where: { equipmentId: { in: equipmentIds } },
    _sum: { quantityNeeded: true },
  });
  const demandMap = new Map<string, number>();
  for (const d of demandRows) {
    demandMap.set(d.equipmentId, d._sum.quantityNeeded ?? 0);
  }

  return rows.map((r) => {
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
      assetTypeOverride: r.assetTypeOverride,
      equipmentAssetType: r.equipment.assetType,
      addedBy: r.addedBy,
      totalDemand,
      shortage,
    };
  });
}

/** Scenes that reference a given Equipment, with per-scene demand. */
export async function getScenesUsingEquipment(equipmentId: string) {
  const rows = await prisma.sceneAsset.findMany({
    where: { equipmentId },
    include: {
      scene: {
        select: { id: true, number: true, title: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    sceneAssetId: r.id,
    quantityNeeded: r.quantityNeeded,
    notes: r.notes,
    scene: r.scene,
  }));
}
