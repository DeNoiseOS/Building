import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/logger";

/**
 * Tests for the logger seam.
 *
 * Each test spies the underlying console method, calls a `log.*`
 * helper, and asserts the console received exactly what we expect.
 * These tests are the contract the future Sentry / Datadog swap must
 * preserve.
 */
describe("logger", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("routing", () => {
    it("log.debug -> console.debug", () => {
      log.debug("hello");
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("log.info -> console.info", () => {
      log.info("hello");
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it("log.warn -> console.warn", () => {
      log.warn("hello");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("log.error -> console.error", () => {
      log.error("hello");
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("formatting", () => {
    it("prefixes messages with [level]", () => {
      log.info("user signed in");
      expect(infoSpy.mock.calls[0][0]).toBe("[info] user signed in");
    });

    it("appends serialised JSON context", () => {
      log.info("user signed in", { userId: "u-1", tier: 3 });
      expect(infoSpy.mock.calls[0][0]).toBe(
        '[info] user signed in {"userId":"u-1","tier":3}',
      );
    });

    it("omits the JSON suffix when no context is given", () => {
      log.warn("cache miss");
      expect(warnSpy.mock.calls[0][0]).toBe("[warn] cache miss");
    });
  });

  describe("error handling", () => {
    it("normalises an Error into name/message/stack fields", () => {
      const err = new TypeError("bad input");
      err.stack = "TypeError: bad input\n    at foo";
      log.error("failed to process", err);

      const line = errorSpy.mock.calls[0][0] as string;
      expect(line.startsWith("[error] failed to process ")).toBe(true);
      const parsed = JSON.parse(line.slice("[error] failed to process ".length));
      expect(parsed).toEqual({
        errorName: "TypeError",
        errorMessage: "bad input",
        stack: "TypeError: bad input\n    at foo",
      });
    });

    it("still accepts plain LogContext (not an Error)", () => {
      log.error("failed to process", { requestId: "req-9" });
      expect(errorSpy.mock.calls[0][0]).toBe(
        '[error] failed to process {"requestId":"req-9"}',
      );
    });
  });

  describe("robustness", () => {
    it("does not throw on circular context, prints [unserialisable]", () => {
      const ctx: Record<string, unknown> = { name: "circular" };
      ctx.self = ctx;
      expect(() => log.info("cyclic", ctx as never)).not.toThrow();
      expect(infoSpy.mock.calls[0][0]).toBe("[info] cyclic [unserialisable]");
    });

    it("handles BigInt in context gracefully", () => {
      // JSON.stringify throws on BigInt by default.
      expect(() =>
        log.info("bignum", { n: BigInt(9007199254740993) } as never),
      ).not.toThrow();
      expect(infoSpy.mock.calls[0][0]).toBe("[info] bignum [unserialisable]");
    });
  });
});
