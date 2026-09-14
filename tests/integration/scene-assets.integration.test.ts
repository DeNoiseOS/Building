import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getSceneAssetsForDepartment, getScenesUsingEquipment } from "@/lib/scene-assets";
import { prisma } from "@/lib/prisma";

/**
 * Integration tests for lib/scene-assets.ts.
 *
 * Locks the demand-aggregation math (totalDemand, shortage) so we
 * can strip the `(prisma as any).sceneAsset` defensive casts without
 * silently changing what the widget sees.
 */
describe("scene-assets (integration — real Prisma)", () => {
  const created = {
    userIds: [] as string[],
    projectIds: [] as string[],
  };

  afterEach(async () => {
    // Project deletion cascades through Scene → SceneAsset,
    // Department → Equipment. Users are the last standing FK holder.
    if (created.projectIds.length > 0) {
      await prisma.project.deleteMany({ where: { id: { in: created.projectIds } } });
      created.projectIds = [];
    }
    if (created.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
      created.userIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedScenario() {
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await prisma.user.create({
      data: {
        name: `sa-owner-${uniq}`,
        email: `sa-owner-${uniq}@test.local`,
        password: "x",
      },
    });
    created.userIds.push(owner.id);

    const now = new Date();
    const project = await prisma.project.create({
      data: {
        name: `sa-proj-${uniq}`,
        userId: owner.id,
        role: "producer",
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400_000),
      },
    });
    created.projectIds.push(project.id);

    const dept = await prisma.department.create({
      data: {
        projectId: project.id,
        key: "art",
        name: "Art",
        kind: "art_director",
      },
    });

    const eqBig = await prisma.equipment.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        name: "Vintage lamp",
        quantity: 5, // plenty
        assetType: "action_prop",
      },
    });
    const eqTight = await prisma.equipment.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        name: "Signed script (rare)",
        quantity: 1, // scarce
      },
    });

    const scene1 = await prisma.scene.create({
      data: {
        projectId: project.id,
        number: "1",
        title: "Opening",
        createdByUserId: owner.id,
      },
    });
    const scene2 = await prisma.scene.create({
      data: {
        projectId: project.id,
        number: "2",
        title: "Café",
        createdByUserId: owner.id,
      },
    });

    // Scene 1: needs 2 vintage lamps + 1 signed script.
    await prisma.sceneAsset.create({
      data: {
        sceneId: scene1.id,
        equipmentId: eqBig.id,
        quantityNeeded: 2,
        addedByUserId: owner.id,
      },
    });
    await prisma.sceneAsset.create({
      data: {
        sceneId: scene1.id,
        equipmentId: eqTight.id,
        quantityNeeded: 1,
        addedByUserId: owner.id,
      },
    });
    // Scene 2: also needs 1 signed script (overbooks the inventory).
    await prisma.sceneAsset.create({
      data: {
        sceneId: scene2.id,
        equipmentId: eqTight.id,
        quantityNeeded: 1,
        addedByUserId: owner.id,
      },
    });

    return { owner, project, dept, eqBig, eqTight, scene1, scene2 };
  }

  describe("getSceneAssetsForDepartment", () => {
    it("returns rows for the requested scene + department, ordered by createdAt", async () => {
      const { dept, scene1 } = await seedScenario();
      const rows = await getSceneAssetsForDepartment({
        sceneId: scene1.id,
        departmentId: dept.id,
      });
      expect(rows).toHaveLength(2);
      // Lamp was inserted before script — createdAt asc keeps that order.
      expect(rows[0].equipmentName).toBe("Vintage lamp");
      expect(rows[1].equipmentName).toBe("Signed script (rare)");
    });

    it("computes totalDemand across ALL scenes, not just the queried one", async () => {
      const { dept, scene1 } = await seedScenario();
      const rows = await getSceneAssetsForDepartment({
        sceneId: scene1.id,
        departmentId: dept.id,
      });
      const script = rows.find((r) => r.equipmentName === "Signed script (rare)")!;
      // Script demand = 1 (scene1) + 1 (scene2) = 2.
      expect(script.totalDemand).toBe(2);
    });

    it("computes shortage = max(0, totalDemand − inventory)", async () => {
      const { dept, scene1 } = await seedScenario();
      const rows = await getSceneAssetsForDepartment({
        sceneId: scene1.id,
        departmentId: dept.id,
      });
      const lamp = rows.find((r) => r.equipmentName === "Vintage lamp")!;
      const script = rows.find((r) => r.equipmentName === "Signed script (rare)")!;
      // Lamp: totalDemand=2, quantity=5 → shortage 0.
      expect(lamp.shortage).toBe(0);
      // Script: totalDemand=2, quantity=1 → shortage 1.
      expect(script.shortage).toBe(1);
    });

    it("returns [] when the scene has no assets for the requested department", async () => {
      const { project, scene1 } = await seedScenario();
      // A department with no equipment linked to scene1's assets:
      const otherDept = await prisma.department.create({
        data: {
          projectId: project.id,
          key: "cam",
          name: "Camera",
          kind: "director_of_photography",
        },
      });
      const rows = await getSceneAssetsForDepartment({
        sceneId: scene1.id,
        departmentId: otherDept.id,
      });
      expect(rows).toEqual([]);
    });
  });

  describe("getScenesUsingEquipment", () => {
    it("returns every scene that references a given equipment, with per-scene demand", async () => {
      const { eqTight } = await seedScenario();
      const rows = await getScenesUsingEquipment(eqTight.id);
      expect(rows).toHaveLength(2);
      const totals = rows.map((r) => r.quantityNeeded);
      expect(totals).toEqual([1, 1]);
      expect(rows.map((r) => r.scene.number).sort()).toEqual(["1", "2"]);
    });

    it("returns [] for an equipment nothing references", async () => {
      const { project, dept } = await seedScenario();
      const lonely = await prisma.equipment.create({
        data: {
          projectId: project.id,
          departmentId: dept.id,
          name: "Unused prop",
          quantity: 1,
        },
      });
      const rows = await getScenesUsingEquipment(lonely.id);
      expect(rows).toEqual([]);
    });
  });
});
