import { describe, expect, it } from "vitest";

describe("vitest runner", () => {
  it("evaluates a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @ alias to project root", async () => {
    const { ROLE_LABELS } = await import("@/lib/roles");
    expect(typeof ROLE_LABELS).toBe("object");
    expect(Object.keys(ROLE_LABELS).length).toBeGreaterThan(0);
  });
});
