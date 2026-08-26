import { describe, expect, it, vi } from "vitest";

// permissions.ts imports "server-only" and prisma. When we pass a
// resolved `memberRole` in the context, `resolveContext` short-circuits
// and never touches prisma. But for the "owner" and "non-member" test
// paths, `memberRole` is undefined and resolveContext DOES fall through
// to a lookup — so we give the mock the exact methods it expects, each
// returning the "not found" answer so the code falls back to null/[].
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
    project: { findFirst: vi.fn().mockResolvedValue(null) },
    departmentMember: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import {
  canChangeProjectCurrency,
  canCommentOnScene,
  canDecideCreativeApproval,
  canDeleteProject,
  canEditProjectSettings,
  canManageCast,
  canManageMember,
  canManageProjectMembers,
  canManageScene,
  canReportDamage,
  canRequestCreativeApproval,
  canSeeInternalTasks,
  canTransferOwnership,
  canViewAnalytics,
  canViewFinancials,
  canViewProjectBudgetByRole,
  isClientCaller,
  taskVisibilityFilter,
} from "@/lib/permissions";

/**
 * Test helpers.
 *
 * `resolveContext` inside permissions.ts uses `??` fallbacks — passing
 * pre-resolved fields skips the Prisma calls entirely. So every test
 * here supplies (memberRole, isOwner, departmentIds) and asserts the
 * decision the function would make with those inputs.
 */
const uid = "user-1";
const pid = "project-1";
const ctx = (memberRole: string | null, isOwner = false) => ({
  userId: uid,
  projectId: pid,
  memberRole: memberRole ?? undefined,
  isOwner,
  departmentIds: [] as string[],
});

// Concrete role samples drawn from lib/roles.ts (V0.24 client roles use
// the "agency_" prefix).
const CLIENT = "agency_creative_director";
const CLIENT_ALT = "agency_copywriter";
const OWNER_CTX = ctx(null, true);
const EP = "executive_producer";
const PRODUCER = "producer";
const DIRECTOR = "director";
const AD = "assistant_director";
const AD_1ST = "first_assistant_director";
const ART_DIR = "art_director";
const NON_MEMBER = ctx(null);

// ─── Strict owner-only ──────────────────────────────────────────────

describe("owner-only authorities (V0.11)", () => {
  it("canDeleteProject is true only for the owner", async () => {
    expect(await canDeleteProject(OWNER_CTX)).toBe(true);
    expect(await canDeleteProject(ctx(EP))).toBe(false);
    expect(await canDeleteProject(ctx(PRODUCER))).toBe(false);
    expect(await canDeleteProject(ctx(DIRECTOR))).toBe(false);
    expect(await canDeleteProject(NON_MEMBER)).toBe(false);
  });

  it("canTransferOwnership is true only for the owner", async () => {
    expect(await canTransferOwnership(OWNER_CTX)).toBe(true);
    expect(await canTransferOwnership(ctx(EP))).toBe(false);
    expect(await canTransferOwnership(ctx(PRODUCER))).toBe(false);
  });

  it("canManageMember is owner-only (V0.5 policy preserved)", async () => {
    expect(await canManageMember(OWNER_CTX)).toBe(true);
    expect(await canManageMember(ctx(PRODUCER))).toBe(false);
    expect(await canManageMember(ctx(DIRECTOR))).toBe(false);
  });
});

// ─── Financial + settings tier (Owner + EP + Producer) ─────────────

describe("financial/settings tier (V0.11 + V0.12.1)", () => {
  it("canChangeProjectCurrency: Owner + EP + Producer only", async () => {
    expect(await canChangeProjectCurrency(OWNER_CTX)).toBe(true);
    expect(await canChangeProjectCurrency(ctx(EP))).toBe(true);
    expect(await canChangeProjectCurrency(ctx(PRODUCER))).toBe(true);
    expect(await canChangeProjectCurrency(ctx(DIRECTOR))).toBe(false);
    expect(await canChangeProjectCurrency(ctx(ART_DIR))).toBe(false);
    expect(await canChangeProjectCurrency(NON_MEMBER)).toBe(false);
  });

  it("canViewAnalytics: same tier as currency", async () => {
    expect(await canViewAnalytics(OWNER_CTX)).toBe(true);
    expect(await canViewAnalytics(ctx(EP))).toBe(true);
    expect(await canViewAnalytics(ctx(PRODUCER))).toBe(true);
    expect(await canViewAnalytics(ctx(DIRECTOR))).toBe(false);
  });

  it("canEditProjectSettings === canManageProjectMembers", async () => {
    for (const role of [null, EP, PRODUCER, DIRECTOR, ART_DIR]) {
      const c = ctx(role, role === null);
      expect(await canEditProjectSettings(c)).toBe(await canManageProjectMembers(c));
    }
  });
});

// ─── Project budget (project-wide roles) ────────────────────────────

describe("canViewProjectBudgetByRole (sync, V0.6.2)", () => {
  it("true for project-wide roles, false for others and null", () => {
    expect(canViewProjectBudgetByRole(PRODUCER)).toBe(true);
    expect(canViewProjectBudgetByRole(DIRECTOR)).toBe(true);
    expect(canViewProjectBudgetByRole(EP)).toBe(true);
    expect(canViewProjectBudgetByRole(ART_DIR)).toBe(false);
    expect(canViewProjectBudgetByRole("editor")).toBe(false);
    expect(canViewProjectBudgetByRole(null)).toBe(false);
  });
});

// ─── Scene authoring (V0.17) ────────────────────────────────────────

describe("canManageScene (V0.17 allow-list)", () => {
  it("allows Owner + EP + Producer + Director + AD variants", async () => {
    expect(await canManageScene(OWNER_CTX)).toBe(true);
    for (const r of [EP, PRODUCER, DIRECTOR, AD, AD_1ST]) {
      expect(await canManageScene(ctx(r))).toBe(true);
    }
  });

  it("denies dept heads, non-scene roles, and non-members", async () => {
    for (const r of [ART_DIR, "camera_department", "editor", "sound_department"]) {
      expect(await canManageScene(ctx(r))).toBe(false);
    }
    expect(await canManageScene(NON_MEMBER)).toBe(false);
  });

  it("canRequestCreativeApproval mirrors canManageScene", async () => {
    for (const c of [OWNER_CTX, ctx(DIRECTOR), ctx(ART_DIR), NON_MEMBER]) {
      expect(await canRequestCreativeApproval(c)).toBe(await canManageScene(c));
    }
  });

  it("canManageCast: canManageScene ∪ casting roles", async () => {
    expect(await canManageCast(ctx(DIRECTOR))).toBe(true); // via scene mgr
    expect(await canManageCast(ctx("casting_director"))).toBe(true);
    expect(await canManageCast(ctx("casting_manager"))).toBe(true);
    expect(await canManageCast(ctx(ART_DIR))).toBe(false);
    expect(await canManageCast(NON_MEMBER)).toBe(false);
  });
});

// ─── Any-member permissions ─────────────────────────────────────────

describe("any-member permissions", () => {
  it("canReportDamage: owner or any project member", async () => {
    expect(await canReportDamage(OWNER_CTX)).toBe(true);
    expect(await canReportDamage(ctx(ART_DIR))).toBe(true);
    expect(await canReportDamage(ctx("editor"))).toBe(true);
    expect(await canReportDamage(NON_MEMBER)).toBe(false);
  });

  it("canCommentOnScene: owner or any project member (client roles included)", async () => {
    expect(await canCommentOnScene(OWNER_CTX)).toBe(true);
    expect(await canCommentOnScene(ctx(CLIENT))).toBe(true);
    expect(await canCommentOnScene(NON_MEMBER)).toBe(false);
  });
});

// ─── Agency access gate (V0.24) ─────────────────────────────────────

describe("agency access gate (V0.24)", () => {
  it("isClientCaller: true only for CLIENT_ROLE_VALUES", async () => {
    expect(await isClientCaller(ctx(CLIENT))).toBe(true);
    expect(await isClientCaller(ctx(CLIENT_ALT))).toBe(true);
    expect(await isClientCaller(ctx(PRODUCER))).toBe(false);
    expect(await isClientCaller(ctx(DIRECTOR))).toBe(false);
    expect(await isClientCaller(ctx(ART_DIR))).toBe(false);
    expect(await isClientCaller(NON_MEMBER)).toBe(false);
  });

  it("canViewFinancials: everyone EXCEPT client roles", async () => {
    expect(await canViewFinancials(OWNER_CTX)).toBe(true);
    expect(await canViewFinancials(ctx(PRODUCER))).toBe(true);
    expect(await canViewFinancials(ctx(ART_DIR))).toBe(true);
    expect(await canViewFinancials(ctx(CLIENT))).toBe(false);
    expect(await canViewFinancials(ctx(CLIENT_ALT))).toBe(false);
    expect(await canViewFinancials(NON_MEMBER)).toBe(false);
  });

  it("canSeeInternalTasks: everyone EXCEPT client roles", async () => {
    expect(await canSeeInternalTasks(OWNER_CTX)).toBe(true);
    expect(await canSeeInternalTasks(ctx(ART_DIR))).toBe(true);
    expect(await canSeeInternalTasks(ctx(CLIENT))).toBe(false);
  });

  it("canDecideCreativeApproval: ONLY client roles (not even the owner)", async () => {
    expect(await canDecideCreativeApproval(ctx(CLIENT))).toBe(true);
    expect(await canDecideCreativeApproval(ctx(CLIENT_ALT))).toBe(true);
    expect(await canDecideCreativeApproval(OWNER_CTX)).toBe(false);
    expect(await canDecideCreativeApproval(ctx(PRODUCER))).toBe(false);
  });
});

// ─── Task visibility filter ─────────────────────────────────────────

describe("taskVisibilityFilter (V0.6)", () => {
  it("returns undefined (no restriction) for owner + any member", async () => {
    expect(await taskVisibilityFilter(OWNER_CTX)).toBeUndefined();
    expect(await taskVisibilityFilter(ctx(PRODUCER))).toBeUndefined();
    expect(await taskVisibilityFilter(ctx(ART_DIR))).toBeUndefined();
    expect(await taskVisibilityFilter(ctx(CLIENT))).toBeUndefined();
  });

  it("returns the defensive empty-set fragment for non-members", async () => {
    expect(await taskVisibilityFilter(NON_MEMBER)).toEqual({ id: "__never__" });
  });
});
