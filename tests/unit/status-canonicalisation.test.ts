import { describe, expect, it, vi } from "vitest";

// Both -data files import "server-only" + prisma; stub both so this
// pure-shape test doesn't need a Prisma client.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
    project: { findFirst: vi.fn().mockResolvedValue(null) },
    departmentMember: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import {
  CUSTODY_STATUS as CS_STATUS,
  CUSTODY_STATUS_LABELS as CSL_STATUS,
} from "@/lib/custody-status";
import {
  CUSTODY_STATUS as CS_DATA,
  CUSTODY_STATUS_LABELS as CSL_DATA,
} from "@/lib/custody-data";

import {
  EQUIPMENT_STATUS as ES_STATUS,
  EQUIPMENT_STATUS_LABELS as ESL_STATUS,
  DAMAGE_SEVERITY as DS_STATUS,
} from "@/lib/equipment-status";
import {
  EQUIPMENT_STATUS as ES_DATA,
  EQUIPMENT_STATUS_LABELS as ESL_DATA,
  DAMAGE_SEVERITY as DS_DATA,
} from "@/lib/equipment-data";

/**
 * Phase 1.1 — canonicalisation invariants.
 *
 * Before cleanup, each of these constants was defined in TWO files.
 * `-status.ts` and `-data.ts` had diverging values for
 * EQUIPMENT_STATUS in particular (5 vs 8 entries). Every consumer
 * imported from whichever path the author found first.
 *
 * After Phase 1.1, `-data.ts` re-exports from `-status.ts`. These
 * tests lock that identity down so future edits can't silently
 * re-fork them.
 */
describe("status-constant canonicalisation (Phase 1.1)", () => {
  it("CUSTODY_STATUS is the same object across both import paths", () => {
    expect(CS_DATA).toBe(CS_STATUS);
  });

  it("CUSTODY_STATUS_LABELS is the same object across both paths", () => {
    expect(CSL_DATA).toBe(CSL_STATUS);
  });

  it("EQUIPMENT_STATUS is the same object across both paths", () => {
    expect(ES_DATA).toBe(ES_STATUS);
  });

  it("EQUIPMENT_STATUS_LABELS is the same object across both paths", () => {
    expect(ESL_DATA).toBe(ESL_STATUS);
  });

  it("DAMAGE_SEVERITY is the same object across both paths", () => {
    expect(DS_DATA).toBe(DS_STATUS);
  });

  it("EQUIPMENT_STATUS now contains the full V0.16 lifecycle (8 values)", () => {
    const values = ES_STATUS.map((s) => s.value);
    expect(values).toEqual([
      "available",
      "assigned",
      "checked_out",
      "returned",
      "in_maintenance",
      "damaged",
      "retired",
      "lost",
    ]);
  });
});
