import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  projectAccessFilter,
  userHasProjectAccess,
  userIsProjectOwner,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";

/**
 * Integration tests for lib/access.ts — the module called 176 times
 * across the codebase. These tests hit the local test Postgres via a
 * real Prisma client to prove the filter behaves correctly against
 * the actual schema, not just against types.
 *
 * Isolation strategy: every test creates its own users + project and
 * cleans them up in `afterEach`. Emails include `Date.now() +
 * Math.random()` so parallel runs never collide.
 */
describe("access (integration — real Prisma)", () => {
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

  async function mkUser(label: string) {
    const user = await prisma.user.create({
      data: {
        name: `test-${label}`,
        email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
        password: "not-a-real-hash",
      },
    });
    created.userIds.push(user.id);
    return user;
  }

  async function mkProject(ownerId: string, name = "Test project") {
    const now = new Date();
    const p = await prisma.project.create({
      data: {
        name,
        userId: ownerId,
        // Required by the schema — value doesn't affect access filter.
        role: "producer",
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    created.projectIds.push(p.id);
    return p;
  }

  it("owner sees their own project", async () => {
    const owner = await mkUser("owner");
    const project = await mkProject(owner.id);
    const rows = await prisma.project.findMany({
      where: projectAccessFilter(owner.id),
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).toContain(project.id);
  });

  it("non-member does NOT see someone else's project", async () => {
    const owner = await mkUser("owner");
    const stranger = await mkUser("stranger");
    const project = await mkProject(owner.id);
    const rows = await prisma.project.findMany({
      where: projectAccessFilter(stranger.id),
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).not.toContain(project.id);
  });

  it("member sees a project they were added to", async () => {
    const owner = await mkUser("owner");
    const member = await mkUser("member");
    const project = await mkProject(owner.id);
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: member.id, role: "director" },
    });
    const rows = await prisma.project.findMany({
      where: projectAccessFilter(member.id),
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).toContain(project.id);
  });

  it("userIsProjectOwner is true only for the owner", async () => {
    const owner = await mkUser("owner");
    const member = await mkUser("member");
    const project = await mkProject(owner.id);
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: member.id, role: "director" },
    });
    expect(await userIsProjectOwner(owner.id, project.id)).toBe(true);
    expect(await userIsProjectOwner(member.id, project.id)).toBe(false);
  });

  it("userHasProjectAccess is true for owner AND member, false for stranger", async () => {
    const owner = await mkUser("owner");
    const member = await mkUser("member");
    const stranger = await mkUser("stranger");
    const project = await mkProject(owner.id);
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: member.id, role: "director" },
    });
    expect(await userHasProjectAccess(owner.id, project.id)).toBe(true);
    expect(await userHasProjectAccess(member.id, project.id)).toBe(true);
    expect(await userHasProjectAccess(stranger.id, project.id)).toBe(false);
  });

  it("returns fresh Prisma-usable object each call (used inside AND clauses)", async () => {
    // This proves the pattern used at 176 call-sites — combining the
    // filter with additional where conditions via AND — actually
    // resolves through Prisma at runtime, not just types.
    const owner = await mkUser("owner");
    const stranger = await mkUser("stranger");
    const project = await mkProject(owner.id, "Nested where test");

    const ownerMatch = await prisma.project.findFirst({
      where: { AND: [projectAccessFilter(owner.id), { id: project.id }] },
      select: { id: true },
    });
    const strangerMatch = await prisma.project.findFirst({
      where: { AND: [projectAccessFilter(stranger.id), { id: project.id }] },
      select: { id: true },
    });
    expect(ownerMatch?.id).toBe(project.id);
    expect(strangerMatch).toBeNull();
  });
});
