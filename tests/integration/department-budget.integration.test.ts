import { afterAll, afterEach, describe, expect, it } from "vitest";
import { departmentBudgetHeadroom } from "@/lib/custody-data";
import { prisma } from "@/lib/prisma";

/**
 * Integration tests for `departmentBudgetHeadroom` (lib/custody-data.ts)
 * and the surrounding BudgetRequest / Custody / Purchase status
 * interactions. This is the "before ANY refactor" test the audit
 * asked for on the department-budget flow.
 *
 * Formula locked here:
 *
 *   allocated  = DepartmentBudget.approvedAmount ?? allocatedAmount ?? 0
 *   committed  = Σ Custody(status in [active, settled], deptId).amount
 *              + Σ Purchase(status=approved, custodyId=NULL, deptId).amount
 *   headroom   = allocated − committed
 *
 * This is what the CustodyRequest approval endpoint reads to decide
 * whether one more custody would push the department over its cap.
 */
describe("departmentBudgetHeadroom (integration — real Prisma)", () => {
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

  async function seedDept() {
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await prisma.user.create({
      data: {
        name: `db-owner-${uniq}`,
        email: `db-owner-${uniq}@test.local`,
        password: "x",
      },
    });
    created.userIds.push(owner.id);
    const holder = await prisma.user.create({
      data: {
        name: `db-holder-${uniq}`,
        email: `db-holder-${uniq}@test.local`,
        password: "x",
      },
    });
    created.userIds.push(holder.id);

    const now = new Date();
    const project = await prisma.project.create({
      data: {
        name: `db-proj-${uniq}`,
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

    return { owner, holder, project, dept };
  }

  async function setAllocation(
    projectId: string,
    departmentId: string,
    allocatedAmount: number,
    approvedAmount: number | null = null,
  ) {
    return prisma.departmentBudget.upsert({
      where: { departmentId },
      create: {
        projectId,
        departmentId,
        allocatedAmount,
        approvedAmount,
        status: approvedAmount !== null ? "approved" : "pending",
      },
      update: {
        allocatedAmount,
        approvedAmount,
        status: approvedAmount !== null ? "approved" : "pending",
      },
    });
  }

  async function issueCustody(
    projectId: string,
    departmentId: string,
    holderId: string,
    ownerId: string,
    amount: number,
    status: "active" | "settled" | "cancelled",
  ) {
    return prisma.custody.create({
      data: {
        projectId,
        departmentId,
        holderUserId: holderId,
        issuedByUserId: ownerId,
        amount,
        status,
      },
    });
  }

  async function mkDirectPurchase(
    projectId: string,
    departmentId: string,
    ownerId: string,
    amount: number,
    status: "pending" | "approved" | "rejected",
  ) {
    return prisma.purchase.create({
      data: {
        projectId,
        departmentId,
        type: "purchase",
        categoryKey: "props",
        name: `direct-${status}-${amount}`,
        quantity: 1,
        amount,
        status,
        custodyId: null, // non-custody = counts toward dept committed
        createdByUserId: ownerId,
      },
    });
  }

  // ─── The allocation input ────────────────────────────────────────

  it("returns zeros when the department has no allocation row at all", async () => {
    const { project, dept } = await seedDept();
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr).toEqual({ allocated: 0, committed: 0, headroom: 0 });
  });

  it("uses approvedAmount when set (final agreed cap)", async () => {
    const { project, dept } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 800_00);
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.allocated).toBe(800_00);
    expect(hr.headroom).toBe(800_00);
  });

  it("falls back to allocatedAmount when approvedAmount is NULL (still pending)", async () => {
    const { project, dept } = await seedDept();
    await setAllocation(project.id, dept.id, 1500_00, null);
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.allocated).toBe(1500_00);
    expect(hr.headroom).toBe(1500_00);
  });

  // ─── The commitment side ─────────────────────────────────────────

  it("counts active + settled custodies (both bite the budget)", async () => {
    const { project, dept, owner, holder } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    await issueCustody(project.id, dept.id, holder.id, owner.id, 200_00, "active");
    await issueCustody(project.id, dept.id, holder.id, owner.id, 100_00, "settled");
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.committed).toBe(300_00);
    expect(hr.headroom).toBe(700_00);
  });

  it("IGNORES cancelled custodies (they never really spent)", async () => {
    const { project, dept, owner, holder } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    await issueCustody(project.id, dept.id, holder.id, owner.id, 999_00, "cancelled");
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.committed).toBe(0);
    expect(hr.headroom).toBe(1000_00);
  });

  it("counts approved direct (non-custody) purchases", async () => {
    const { project, dept, owner } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    await mkDirectPurchase(project.id, dept.id, owner.id, 150_00, "approved");
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.committed).toBe(150_00);
    expect(hr.headroom).toBe(850_00);
  });

  it("IGNORES pending / rejected direct purchases", async () => {
    const { project, dept, owner } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    await mkDirectPurchase(project.id, dept.id, owner.id, 300_00, "pending");
    await mkDirectPurchase(project.id, dept.id, owner.id, 400_00, "rejected");
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.committed).toBe(0);
    expect(hr.headroom).toBe(1000_00);
  });

  it("IGNORES purchases already tied to a custody (avoid double-count)", async () => {
    // Custody-linked purchases are represented by the custody amount
    // itself. Counting them again on top would double-charge the
    // department budget.
    const { project, dept, owner, holder } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    const custody = await issueCustody(
      project.id,
      dept.id,
      holder.id,
      owner.id,
      200_00,
      "active",
    );
    await prisma.purchase.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        type: "purchase",
        categoryKey: "props",
        name: "cust-linked",
        quantity: 1,
        amount: 50_00,
        status: "approved",
        custodyId: custody.id,
        createdByUserId: owner.id,
      },
    });
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    // Only the 200 custody counts, not the 50 purchase tied to it.
    expect(hr.committed).toBe(200_00);
    expect(hr.headroom).toBe(800_00);
  });

  it("stacks all commitment sources correctly", async () => {
    const { project, dept, owner, holder } = await seedDept();
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    await issueCustody(project.id, dept.id, holder.id, owner.id, 200_00, "active");
    await issueCustody(project.id, dept.id, holder.id, owner.id, 100_00, "settled");
    await mkDirectPurchase(project.id, dept.id, owner.id, 150_00, "approved");
    // Ignored (cancelled + pending + rejected):
    await issueCustody(project.id, dept.id, holder.id, owner.id, 999_00, "cancelled");
    await mkDirectPurchase(project.id, dept.id, owner.id, 999_00, "pending");
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.committed).toBe(450_00);
    expect(hr.headroom).toBe(550_00);
  });

  it("goes negative when the department is already overspent", async () => {
    const { project, dept, owner, holder } = await seedDept();
    await setAllocation(project.id, dept.id, 100_00, 100_00);
    await issueCustody(project.id, dept.id, holder.id, owner.id, 250_00, "active");
    const hr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(hr.allocated).toBe(100_00);
    expect(hr.committed).toBe(250_00);
    expect(hr.headroom).toBe(-150_00);
  });

  it("scopes to the given department only — sibling depts don't leak in", async () => {
    const { project, dept, owner, holder } = await seedDept();
    // Second dept in the same project with its own custody:
    const otherDept = await prisma.department.create({
      data: {
        projectId: project.id,
        key: "cam",
        name: "Camera",
        kind: "director_of_photography",
      },
    });
    await setAllocation(project.id, dept.id, 1000_00, 1000_00);
    await setAllocation(project.id, otherDept.id, 1000_00, 1000_00);
    await issueCustody(project.id, otherDept.id, holder.id, owner.id, 900_00, "active");
    // Art headroom stays intact.
    const artHr = await departmentBudgetHeadroom(project.id, dept.id);
    expect(artHr.committed).toBe(0);
    expect(artHr.headroom).toBe(1000_00);
    // Camera reflects its own custody.
    const camHr = await departmentBudgetHeadroom(project.id, otherDept.id);
    expect(camHr.committed).toBe(900_00);
    expect(camHr.headroom).toBe(100_00);
  });
});
