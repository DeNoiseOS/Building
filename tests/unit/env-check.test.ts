import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { warnIfQuickLoginInProduction } from "@/lib/env-check";

/**
 * Tests for the Quick-Login production warning.
 *
 * SOFT variant: the guard emits `console.warn` in the danger case;
 * it never throws. These tests verify the warning fires only when
 * BOTH conditions align, and stays silent otherwise.
 *
 * `vi.stubEnv` is used instead of direct `process.env.X = ...` because
 * @types/node marks NODE_ENV as read-only. `unstubAllEnvs()` in
 * afterEach restores the process's real env between tests.
 */
describe("warnIfQuickLoginInProduction", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Neutralise both vars for each test's starting state.
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "");
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("warns when NODE_ENV=production AND NEXT_PUBLIC_QUICK_LOGIN=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "1");
    warnIfQuickLoginInProduction();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/QUICK LOGIN IS ENABLED IN PRODUCTION/);
  });

  it("never throws — even when the danger condition is met", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "1");
    expect(() => warnIfQuickLoginInProduction()).not.toThrow();
  });

  it("stays silent when Quick Login is not set in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "");
    warnIfQuickLoginInProduction();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays silent when Quick Login is a value other than 1 in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "0");
    warnIfQuickLoginInProduction();
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "true");
    warnIfQuickLoginInProduction();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays silent in development even with the flag on", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "1");
    warnIfQuickLoginInProduction();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays silent in test env even with the flag on (CI-safe)", () => {
    vi.stubEnv("NEXT_PUBLIC_QUICK_LOGIN", "1");
    warnIfQuickLoginInProduction();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
