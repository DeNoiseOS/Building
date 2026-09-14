import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// requireUser touches @/lib/auth; the response helpers don't. We mock
// auth to a no-op so the module can import cleanly.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import {
  badRequest,
  conflict,
  created,
  forbidden,
  noContent,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api";

/**
 * Locks the wire contract of every response helper. Any regression
 * (status code drift, error-shape drift) shows up here first.
 */
describe("response helpers (lib/api.ts)", () => {
  describe("success", () => {
    it("ok(): 200 with the body echoed back", async () => {
      const res = ok({ hello: "world" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ hello: "world" });
    });

    it("created(): 201 with the body echoed back", async () => {
      const res = created({ id: "new-id" });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ id: "new-id" });
    });

    it("noContent(): 204 with empty body", async () => {
      const res = noContent();
      expect(res.status).toBe(204);
      // 204 must have no body — .text() returns ""
      expect(await res.text()).toBe("");
    });
  });

  describe("errors — { error, ...meta } shape", () => {
    it("badRequest with message + optional fieldErrors", async () => {
      const res = badRequest("Nope", { name: "required" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Nope");
      expect(body.fieldErrors).toEqual({ name: "required" });
    });

    it("unauthorized default message", async () => {
      const res = unauthorized();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized." });
    });

    it("forbidden default message", async () => {
      const res = forbidden();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Not allowed." });
    });

    it("notFound default message", async () => {
      const res = notFound();
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not found." });
    });

    it("conflict default message", async () => {
      const res = conflict();
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "Conflict." });
    });

    it("serverError default message", async () => {
      const res = serverError();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Something went wrong." });
    });

    it("error helpers respect a custom message", async () => {
      expect(await forbidden("Denied for testing").json()).toEqual({
        error: "Denied for testing",
      });
    });
  });
});
