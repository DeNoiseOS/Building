import { describe, expect, it, vi } from "vitest";

// The access module imports "server-only" and "@/lib/prisma" for its
// side-effect and for downstream helpers. `projectAccessFilter` itself
// touches neither. We mock both so this file stays a pure unit test.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { projectAccessFilter } from "@/lib/access";

/**
 * `projectAccessFilter` is called 176× across the codebase (audit
 * Section F). It is the single decision point for "which projects can
 * this user see". Any change to its return shape silently changes the
 * result of every list endpoint. These tests lock the shape down.
 */
describe("projectAccessFilter", () => {
  it("returns an OR of owner-userId OR member-userId", () => {
    const f = projectAccessFilter("user-123");
    expect(f).toEqual({
      OR: [{ userId: "user-123" }, { members: { some: { userId: "user-123" } } }],
    });
  });

  it("threads the userId through both branches identically", () => {
    const a = projectAccessFilter("user-a");
    const b = projectAccessFilter("user-b");
    expect(a).not.toEqual(b);
    expect((a.OR[0] as { userId: string }).userId).toBe("user-a");
    expect((b.OR[0] as { userId: string }).userId).toBe("user-b");
  });

  it("is deterministic — same input, same output", () => {
    expect(projectAccessFilter("u")).toEqual(projectAccessFilter("u"));
  });

  it("returns a fresh object on each call (no aliasing bug)", () => {
    const a = projectAccessFilter("u");
    const b = projectAccessFilter("u");
    expect(a).not.toBe(b);
    expect(a.OR).not.toBe(b.OR);
  });

  it("handles an empty userId string without throwing", () => {
    // Guards against future callers passing "" by accident; the filter
    // still returns a valid Prisma shape (which would just match nothing).
    const f = projectAccessFilter("");
    expect(f.OR).toHaveLength(2);
  });
});
