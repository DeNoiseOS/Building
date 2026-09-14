import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  canApproveTask,
  canEditSceneDepartment,
  canManageAssets,
  isResolvedDepartmentHead,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Integration tests for the permission functions that reach into
 * Prisma at runtime (isResolvedDepartmentHead + everything that
 * chains through it). These are the ones the pure-logic suite in
 * tests/unit/permissions.test.ts had to skip because they always
 * hit a DB.
 *
 * Locking these down is the prerequisite for Phase 3 (consolidating
 * the 22 can* functions into a single matrix). Without them, the
 * consolidation can silently open or close access.
 *
 * V0.11 head resolution rule (locked here):
 *   A department has an ordered `headRoles` list. The head is the
 *   highest-priority role from that list that is actually present in
 *   the project's ProjectMember rows. Example — Art:
 *     headRoles = [production_designer, art_director,
 *                  assistant_art_director]
 *   If a Production Designer is on the project, THEY are the head.
 *   Absent them, the Art Director. And so on.
 */
describe("permissions (integration — real Prisma)", () => {
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
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: {
        name: `${label}-${uniq}`,
        email: `${label}-${uniq}@perm-test.local`,
        password: "x",
      },
    });
    created.userIds.push(user.id);
    return user;
  }

  async function mkProject(ownerId: string) {
    const now = new Date();
    const p = await prisma.project.create({
      data: {
        name: `perm-test-${Date.now()}`,
        userId: ownerId,
        role: "producer",
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400_000),
      },
    });
    created.projectIds.push(p.id);
    return p;
  }

  async function addMember(projectId: string, userId: string, role: string) {
    return prisma.projectMember.create({
      data: { projectId, userId, role },
    });
  }

  async function mkArtDept(projectId: string) {
    return prisma.department.create({
      data: {
        projectId,
        key: "art",
        name: "Art",
        // V0.10.1 — kind matches the registry's canonical head role
        // for the department, which for Art is `art_director`.
        kind: "art_director",
      },
    });
  }

  const call = (
    userId: string,
    projectId: string,
    overrides: {
      memberRole?: string;
      isOwner?: boolean;
      departmentIds?: string[];
    } = {},
  ) => ({
    userId,
    projectId,
    memberRole: overrides.memberRole,
    isOwner: overrides.isOwner,
    departmentIds: overrides.departmentIds ?? [],
  });

  // ─── isResolvedDepartmentHead ────────────────────────────────────

  describe("isResolvedDepartmentHead — V0.11 priority walk", () => {
    it("art_director alone in the Art dept resolves as head", async () => {
      const owner = await mkUser("owner");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, artDir.id, "art_director");

      const isHead = await isResolvedDepartmentHead(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        "art_director",
      );
      expect(isHead).toBe(true);
    });

    it("production_designer WINS over art_director when both present", async () => {
      const owner = await mkUser("owner");
      const pd = await mkUser("pd");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, pd.id, "production_designer");
      await addMember(project.id, artDir.id, "art_director");

      // The AD is a head-candidate but NOT the resolved head — PD outranks.
      const adIsHead = await isResolvedDepartmentHead(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        "art_director",
      );
      expect(adIsHead).toBe(false);

      // The PD is the resolved head.
      const pdIsHead = await isResolvedDepartmentHead(
        call(pd.id, project.id, { memberRole: "production_designer" }),
        "art_director",
      );
      expect(pdIsHead).toBe(true);
    });

    it("caller with a non-head role is never a head", async () => {
      const owner = await mkUser("owner");
      const propsMaster = await mkUser("props");
      const project = await mkProject(owner.id);
      await addMember(project.id, propsMaster.id, "props_master");

      const isHead = await isResolvedDepartmentHead(
        call(propsMaster.id, project.id, { memberRole: "props_master" }),
        "art_director",
      );
      expect(isHead).toBe(false);
    });

    it("head role for the WRONG department resolves false", async () => {
      const owner = await mkUser("owner");
      const camDop = await mkUser("dop");
      const project = await mkProject(owner.id);
      await addMember(project.id, camDop.id, "director_of_photography");

      // The DoP is a head candidate for Camera, not for Art.
      const isArtHead = await isResolvedDepartmentHead(
        call(camDop.id, project.id, { memberRole: "director_of_photography" }),
        "art_director",
      );
      expect(isArtHead).toBe(false);
    });
  });

  // ─── canManageAssets ─────────────────────────────────────────────

  describe("canManageAssets — chains through isResolvedDepartmentHead", () => {
    it("owner can manage any department's assets", async () => {
      const owner = await mkUser("owner");
      const project = await mkProject(owner.id);
      const can = await canManageAssets(
        call(owner.id, project.id, { isOwner: true }),
        "art_director",
      );
      expect(can).toBe(true);
    });

    it("producer can manage any department's assets", async () => {
      const owner = await mkUser("owner");
      const producer = await mkUser("producer");
      const project = await mkProject(owner.id);
      await addMember(project.id, producer.id, "producer");

      const can = await canManageAssets(
        call(producer.id, project.id, { memberRole: "producer" }),
        "art_director",
      );
      expect(can).toBe(true);
    });

    it("the resolved Art head CAN manage Art assets", async () => {
      const owner = await mkUser("owner");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, artDir.id, "art_director");

      const can = await canManageAssets(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        "art_director",
      );
      expect(can).toBe(true);
    });

    it("a head-candidate who lost priority CANNOT manage assets", async () => {
      // Art Director present alongside a Production Designer — PD is
      // the resolved head, AD is demoted. AD may NOT manage assets.
      const owner = await mkUser("owner");
      const pd = await mkUser("pd");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, pd.id, "production_designer");
      await addMember(project.id, artDir.id, "art_director");

      const can = await canManageAssets(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        "art_director",
      );
      expect(can).toBe(false);
    });

    it("a plain member cannot manage assets", async () => {
      const owner = await mkUser("owner");
      const propsMaster = await mkUser("props");
      const project = await mkProject(owner.id);
      await addMember(project.id, propsMaster.id, "props_master");

      const can = await canManageAssets(
        call(propsMaster.id, project.id, { memberRole: "props_master" }),
        "art_director",
      );
      expect(can).toBe(false);
    });
  });

  // ─── canEditSceneDepartment (unions scene-manager + asset-manager) ─

  describe("canEditSceneDepartment — union of scene mgr + asset mgr", () => {
    it("director can edit ANY department's scene workspace", async () => {
      const owner = await mkUser("owner");
      const director = await mkUser("dir");
      const project = await mkProject(owner.id);
      await addMember(project.id, director.id, "director");

      const can = await canEditSceneDepartment(
        call(director.id, project.id, { memberRole: "director" }),
        "art_director",
      );
      expect(can).toBe(true);
    });

    it("the resolved Art head can edit the Art scene workspace", async () => {
      const owner = await mkUser("owner");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, artDir.id, "art_director");

      const can = await canEditSceneDepartment(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        "art_director",
      );
      expect(can).toBe(true);
    });

    it("a plain project member cannot edit a scene workspace", async () => {
      const owner = await mkUser("owner");
      const editor = await mkUser("editor");
      const project = await mkProject(owner.id);
      await addMember(project.id, editor.id, "editor");

      const can = await canEditSceneDepartment(
        call(editor.id, project.id, { memberRole: "editor" }),
        "art_director",
      );
      expect(can).toBe(false);
    });
  });

  // ─── canApproveTask ──────────────────────────────────────────────

  describe("canApproveTask — approval matrix", () => {
    async function mkTask(
      projectId: string,
      creatorId: string,
      opts: { departmentId?: string; approverId?: string } = {},
    ) {
      return prisma.task.create({
        data: {
          projectId,
          title: `test-task-${Date.now()}`,
          status: "todo",
          priority: "med",
          creatorId,
          departmentId: opts.departmentId ?? null,
          approverId: opts.approverId ?? null,
        },
      });
    }

    it("owner can approve any task", async () => {
      const owner = await mkUser("owner");
      const project = await mkProject(owner.id);
      const task = await mkTask(project.id, owner.id);

      const can = await canApproveTask(call(owner.id, project.id, { isOwner: true }), {
        id: task.id,
        projectId: task.projectId,
        departmentId: task.departmentId,
        creatorId: task.creatorId,
        assigneeId: task.assigneeId,
        approverId: task.approverId,
        ownerDepartment: null,
      });
      expect(can).toBe(true);
    });

    it("producer can approve any task on the project", async () => {
      const owner = await mkUser("owner");
      const producer = await mkUser("producer");
      const project = await mkProject(owner.id);
      await addMember(project.id, producer.id, "producer");
      const task = await mkTask(project.id, owner.id);

      const can = await canApproveTask(
        call(producer.id, project.id, { memberRole: "producer" }),
        {
          id: task.id,
          projectId: task.projectId,
          departmentId: task.departmentId,
          creatorId: task.creatorId,
          assigneeId: task.assigneeId,
          approverId: task.approverId,
          ownerDepartment: null,
        },
      );
      expect(can).toBe(true);
    });

    it("an explicit approverId ALWAYS wins", async () => {
      const owner = await mkUser("owner");
      const stranger = await mkUser("stranger");
      const project = await mkProject(owner.id);
      await addMember(project.id, stranger.id, "editor");
      const task = await mkTask(project.id, owner.id, { approverId: stranger.id });

      const can = await canApproveTask(
        call(stranger.id, project.id, { memberRole: "editor" }),
        {
          id: task.id,
          projectId: task.projectId,
          departmentId: task.departmentId,
          creatorId: task.creatorId,
          assigneeId: task.assigneeId,
          approverId: task.approverId,
          ownerDepartment: null,
        },
      );
      expect(can).toBe(true);
    });

    it("resolved dept head can approve tasks owned by their department", async () => {
      const owner = await mkUser("owner");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, artDir.id, "art_director");
      const dept = await mkArtDept(project.id);
      const task = await mkTask(project.id, owner.id, { departmentId: dept.id });

      const can = await canApproveTask(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        {
          id: task.id,
          projectId: task.projectId,
          departmentId: task.departmentId,
          creatorId: task.creatorId,
          assigneeId: task.assigneeId,
          approverId: task.approverId,
          ownerDepartment: { kind: dept.kind },
        },
      );
      expect(can).toBe(true);
    });

    it("a demoted head-candidate CANNOT approve their department's task", async () => {
      const owner = await mkUser("owner");
      const pd = await mkUser("pd");
      const artDir = await mkUser("ad");
      const project = await mkProject(owner.id);
      await addMember(project.id, pd.id, "production_designer");
      await addMember(project.id, artDir.id, "art_director");
      const dept = await mkArtDept(project.id);
      const task = await mkTask(project.id, owner.id, { departmentId: dept.id });

      const can = await canApproveTask(
        call(artDir.id, project.id, { memberRole: "art_director" }),
        {
          id: task.id,
          projectId: task.projectId,
          departmentId: task.departmentId,
          creatorId: task.creatorId,
          assigneeId: task.assigneeId,
          approverId: task.approverId,
          ownerDepartment: { kind: dept.kind },
        },
      );
      expect(can).toBe(false);
    });

    it("returns false when task and caller are on different projects", async () => {
      const owner = await mkUser("owner");
      const producer = await mkUser("producer");
      const projectA = await mkProject(owner.id);
      const projectB = await mkProject(owner.id);
      await addMember(projectA.id, producer.id, "producer");
      const taskOnB = await mkTask(projectB.id, owner.id);

      const can = await canApproveTask(
        call(producer.id, projectA.id, { memberRole: "producer" }),
        {
          id: taskOnB.id,
          projectId: taskOnB.projectId, // != caller's projectId
          departmentId: taskOnB.departmentId,
          creatorId: taskOnB.creatorId,
          assigneeId: taskOnB.assigneeId,
          approverId: taskOnB.approverId,
          ownerDepartment: null,
        },
      );
      expect(can).toBe(false);
    });
  });
});
