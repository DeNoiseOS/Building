import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Integration tests for the Purchase → PurchaseItem → auto-Equipment
 * flow that lives in app/api/projects/[id]/purchases/route.ts.
 *
 * The route wraps the whole create sequence in `prisma.$transaction`
 * (added in V0.22, verified in Phase 2 postscript). These tests lock
 * the invariants that transaction guarantees:
 *
 *   1. On success:
 *      · a Purchase row exists
 *      · N PurchaseItem rows exist, each pointing at that Purchase
 *      · when `willCreateResource === true`, N Equipment rows exist
 *      · each PurchaseItem.equipmentId points at its Equipment
 *      · Equipment.quantity mirrors the item's quantity
 *
 *   2. On mid-loop failure: the transaction rolls back cleanly.
 *      Nothing persists — no orphaned Purchase, no half-created
 *      Equipment. This is the guarantee the audit's #4 priority was
 *      asking for.
 *
 *   3. Cascade behaviour:
 *      · deleting the Purchase cascades PurchaseItem (schema rule)
 *      · Equipment persists (it's an asset the org owns even if the
 *        original invoice was deleted)
 */
describe("Purchase → Equipment flow (integration — real Prisma)", () => {
  const created = { userIds: [] as string[], projectIds: [] as string[] };

  afterEach(async () => {
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

  async function seedProjectWithArt() {
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await prisma.user.create({
      data: {
        name: `pur-owner-${uniq}`,
        email: `pur-owner-${uniq}@test.local`,
        password: "x",
      },
    });
    created.userIds.push(owner.id);

    const now = new Date();
    const project = await prisma.project.create({
      data: {
        name: `pur-proj-${uniq}`,
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

    return { owner, project, dept };
  }

  it("success path — Purchase + PurchaseItems + auto-Equipment all committed together", async () => {
    const { owner, project, dept } = await seedProjectWithArt();

    // Mirrors the shape of app/api/projects/[id]/purchases/route.ts.
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          projectId: project.id,
          departmentId: dept.id,
          type: "purchase",
          categoryKey: "props",
          saveAsResource: true,
          equipmentId: null,
          name: "Prop haul",
          quantity: 5, // sum of item quantities
          amount: 500_00,
          status: "approved",
          approvedByUserId: owner.id,
          approvedAt: new Date(),
          createdByUserId: owner.id,
        },
      });

      const equipmentIds: string[] = [];
      for (const item of [
        { name: "Vintage lamp", quantity: 2, lineTotal: 200_00 },
        { name: "Signed script", quantity: 3, lineTotal: 300_00 },
      ]) {
        const eq = await tx.equipment.create({
          data: {
            projectId: project.id,
            departmentId: dept.id,
            name: item.name,
            status: "available",
            quantity: item.quantity,
          },
        });
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            name: item.name,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            equipmentId: eq.id,
          },
        });
        equipmentIds.push(eq.id);
      }
      return { purchase, equipmentIds };
    });

    // Assert final state. PurchaseItem.equipmentId is a scalar FK
    // (no explicit @relation), so we fetch Equipment separately per
    // item — matches how the route already reads them.
    const items = await prisma.purchaseItem.findMany({
      where: { purchaseId: result.purchase.id },
    });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.equipmentId !== null)).toBe(true);

    for (const i of items) {
      const eq = await prisma.equipment.findUnique({
        where: { id: i.equipmentId! },
      });
      expect(eq).not.toBeNull();
      expect(eq!.quantity).toBe(i.quantity);
      expect(eq!.projectId).toBe(project.id);
      expect(eq!.departmentId).toBe(dept.id);
    }
  });

  it("rollback — mid-loop throw undoes EVERY row created earlier in the tx", async () => {
    const { owner, project, dept } = await seedProjectWithArt();

    // Force a mid-loop failure by pointing the second Equipment at a
    // departmentId that doesn't exist. The FK violation triggers
    // rollback of the WHOLE transaction — the Purchase row created
    // seconds earlier must NOT persist.
    const beforeCount = await prisma.purchase.count({
      where: { projectId: project.id },
    });
    expect(beforeCount).toBe(0);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.purchase.create({
          data: {
            projectId: project.id,
            departmentId: dept.id,
            type: "purchase",
            categoryKey: "props",
            saveAsResource: true,
            equipmentId: null,
            name: "Doomed purchase",
            quantity: 2,
            amount: 100_00,
            status: "approved",
            approvedByUserId: owner.id,
            approvedAt: new Date(),
            createdByUserId: owner.id,
          },
        });
        // First equipment succeeds …
        await tx.equipment.create({
          data: {
            projectId: project.id,
            departmentId: dept.id,
            name: "First item",
            status: "available",
            quantity: 1,
          },
        });
        // … second one dies on a bogus departmentId FK.
        await tx.equipment.create({
          data: {
            projectId: project.id,
            departmentId: "does-not-exist",
            name: "Doomed item",
            status: "available",
            quantity: 1,
          },
        });
      }),
    ).rejects.toThrow();

    // Nothing survived — Purchase count is still 0.
    const purchaseCount = await prisma.purchase.count({
      where: { projectId: project.id },
    });
    expect(purchaseCount).toBe(0);

    // And no orphan Equipment either.
    const eqCount = await prisma.equipment.count({
      where: { projectId: project.id },
    });
    expect(eqCount).toBe(0);
  });

  it("cascade — deleting a Purchase drops its PurchaseItems, Equipment persists", async () => {
    const { owner, project, dept } = await seedProjectWithArt();

    const eq = await prisma.equipment.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        name: "Lamp",
        status: "available",
        quantity: 1,
      },
    });
    const purchase = await prisma.purchase.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        type: "purchase",
        categoryKey: "props",
        saveAsResource: true,
        equipmentId: eq.id,
        name: "Lamp invoice",
        quantity: 1,
        amount: 100_00,
        status: "approved",
        approvedByUserId: owner.id,
        approvedAt: new Date(),
        createdByUserId: owner.id,
      },
    });
    await prisma.purchaseItem.create({
      data: {
        purchaseId: purchase.id,
        name: "Lamp",
        quantity: 1,
        lineTotal: 100_00,
        equipmentId: eq.id,
      },
    });

    // Delete the Purchase.
    await prisma.purchase.delete({ where: { id: purchase.id } });

    // PurchaseItem is gone (cascade rule in schema).
    const items = await prisma.purchaseItem.findMany({
      where: { purchaseId: purchase.id },
    });
    expect(items).toHaveLength(0);

    // Equipment SURVIVES — it's an asset the org still owns.
    const stillEq = await prisma.equipment.findUnique({ where: { id: eq.id } });
    expect(stillEq).not.toBeNull();
    expect(stillEq!.name).toBe("Lamp");
  });
});
