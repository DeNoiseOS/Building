import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  custodyAvailable,
  custodyReservedByPending,
  custodySpent,
} from "@/lib/custody-data";
import { prisma } from "@/lib/prisma";

/**
 * Integration tests for the custody-balance math in
 * lib/custody-data.ts. The audit called this out as one of the
 * highest-risk untested areas (state machine + monetary math + no
 * existing coverage). These tests lock the invariants:
 *
 *   custodySpent(id)            = Σ BudgetRequest(status='purchased', custodyId=id).estimatedCost
 *                               + Σ Purchase(status='approved',     custodyId=id).amount
 *
 *   custodyReservedByPending(id, exclude?) = Σ Purchase(status='pending', custodyId=id).amount
 *     – excluding `exclude` when re-checking an in-flight pending row.
 *
 *   custodyAvailable(id, amount, exclude?) = amount − spent − reservedPending(exclude)
 *
 * These are the numbers the head sees when deciding whether to
 * approve one more purchase against a member's custody.
 */
describe("custody-data math (integration — real Prisma)", () => {
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

  async function seedCustody(amount: number) {
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await prisma.user.create({
      data: {
        name: `cust-owner-${uniq}`,
        email: `cust-owner-${uniq}@test.local`,
        password: "x",
      },
    });
    created.userIds.push(owner.id);
    const holder = await prisma.user.create({
      data: {
        name: `cust-holder-${uniq}`,
        email: `cust-holder-${uniq}@test.local`,
        password: "x",
      },
    });
    created.userIds.push(holder.id);

    const now = new Date();
    const project = await prisma.project.create({
      data: {
        name: `cust-proj-${uniq}`,
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

    const custody = await prisma.custody.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        holderUserId: holder.id,
        issuedByUserId: owner.id,
        amount,
        status: "active",
      },
    });

    return { owner, holder, project, dept, custody };
  }

  async function mkBudgetRequest(
    projectId: string,
    departmentId: string,
    requesterId: string,
    custodyId: string,
    estimatedCost: number,
    status: "draft" | "purchased" | "approved" | "rejected" | "pending",
  ) {
    return prisma.budgetRequest.create({
      data: {
        projectId,
        departmentId,
        requesterId,
        custodyId,
        title: `br-${status}-${estimatedCost}`,
        estimatedCost,
        status,
      },
    });
  }

  async function mkPurchase(
    projectId: string,
    departmentId: string,
    ownerId: string,
    custodyId: string,
    amount: number,
    status: "pending" | "approved" | "rejected",
  ) {
    return prisma.purchase.create({
      data: {
        projectId,
        departmentId,
        type: "purchase",
        categoryKey: "props",
        name: `p-${status}-${amount}`,
        quantity: 1,
        amount,
        status,
        custodyId,
        createdByUserId: ownerId,
      },
    });
  }

  // ─── custodySpent ────────────────────────────────────────────────

  describe("custodySpent", () => {
    it("returns 0 for a custody with no linked expenses or purchases", async () => {
      const { custody } = await seedCustody(1000_00);
      expect(await custodySpent(custody.id)).toBe(0);
    });

    it("sums ONLY BudgetRequest(status=purchased) — not draft/approved/rejected", async () => {
      const { project, dept, holder, custody } = await seedCustody(1000_00);
      await mkBudgetRequest(
        project.id,
        dept.id,
        holder.id,
        custody.id,
        50_00,
        "purchased",
      );
      await mkBudgetRequest(
        project.id,
        dept.id,
        holder.id,
        custody.id,
        200_00,
        "purchased",
      );
      await mkBudgetRequest(
        project.id,
        dept.id,
        holder.id,
        custody.id,
        999_00,
        "approved",
      ); // ignored
      await mkBudgetRequest(project.id, dept.id, holder.id, custody.id, 999_00, "draft"); // ignored
      await mkBudgetRequest(
        project.id,
        dept.id,
        holder.id,
        custody.id,
        999_00,
        "rejected",
      ); // ignored
      expect(await custodySpent(custody.id)).toBe(250_00);
    });

    it("sums ONLY Purchase(status=approved) — not pending/rejected", async () => {
      const { project, dept, owner, custody } = await seedCustody(1000_00);
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 30_00, "approved");
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 70_00, "approved");
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 999_00, "pending"); // ignored
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 999_00, "rejected"); // ignored
      expect(await custodySpent(custody.id)).toBe(100_00);
    });

    it("adds legacy BudgetRequest.purchased + V0.13 Purchase.approved", async () => {
      const { project, dept, owner, holder, custody } = await seedCustody(1000_00);
      await mkBudgetRequest(
        project.id,
        dept.id,
        holder.id,
        custody.id,
        150_00,
        "purchased",
      );
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 75_00, "approved");
      expect(await custodySpent(custody.id)).toBe(225_00);
    });

    it("ignores rows tied to OTHER custodies", async () => {
      const seed = await seedCustody(1000_00);
      const other = await seedCustody(500_00); // separate project + custody
      await mkBudgetRequest(
        other.project.id,
        other.dept.id,
        other.holder.id,
        other.custody.id,
        99_00,
        "purchased",
      );
      expect(await custodySpent(seed.custody.id)).toBe(0);
    });
  });

  // ─── custodyReservedByPending ────────────────────────────────────

  describe("custodyReservedByPending", () => {
    it("sums only Purchase(status=pending) on this custody", async () => {
      const { project, dept, owner, custody } = await seedCustody(1000_00);
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 40_00, "pending");
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 60_00, "pending");
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 999_00, "approved"); // ignored
      expect(await custodyReservedByPending(custody.id)).toBe(100_00);
    });

    it("excludes the specified purchase id (re-check of an in-flight pending)", async () => {
      const { project, dept, owner, custody } = await seedCustody(1000_00);
      const p1 = await mkPurchase(
        project.id,
        dept.id,
        owner.id,
        custody.id,
        40_00,
        "pending",
      );
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 60_00, "pending");
      // Excluding p1 → only the other pending counts.
      expect(await custodyReservedByPending(custody.id, p1.id)).toBe(60_00);
    });
  });

  // ─── custodyAvailable ────────────────────────────────────────────

  describe("custodyAvailable", () => {
    it("= amount when nothing spent, nothing reserved", async () => {
      const { custody } = await seedCustody(1000_00);
      expect(await custodyAvailable(custody.id, custody.amount)).toBe(1000_00);
    });

    it("= amount − spent − reservedPending", async () => {
      const { project, dept, owner, holder, custody } = await seedCustody(1000_00);
      await mkBudgetRequest(
        project.id,
        dept.id,
        holder.id,
        custody.id,
        200_00,
        "purchased",
      ); // spent
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 100_00, "approved"); // spent
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 150_00, "pending"); // reserved
      // 1000 − (200 + 100) − 150 = 550
      expect(await custodyAvailable(custody.id, custody.amount)).toBe(550_00);
    });

    it("can go negative when overspent (caller decides whether to allow)", async () => {
      const { project, dept, owner, custody } = await seedCustody(100_00);
      await mkPurchase(project.id, dept.id, owner.id, custody.id, 250_00, "approved");
      expect(await custodyAvailable(custody.id, custody.amount)).toBe(-150_00);
    });

    it("re-check on an in-flight pending excludes it from reservation", async () => {
      const { project, dept, owner, custody } = await seedCustody(1000_00);
      const inflight = await mkPurchase(
        project.id,
        dept.id,
        owner.id,
        custody.id,
        400_00,
        "pending",
      );
      // Without exclusion: reserved = 400 → available = 600.
      expect(await custodyAvailable(custody.id, custody.amount)).toBe(600_00);
      // Re-checking the inflight row: it's excluded → available = 1000.
      expect(await custodyAvailable(custody.id, custody.amount, inflight.id)).toBe(
        1000_00,
      );
    });
  });
});
