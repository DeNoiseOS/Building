import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Standard response helpers for REST API routes.
 *
 * Every route should assemble responses from THESE helpers rather
 * than calling `NextResponse.json(...)` directly. That keeps the
 * error-shape convention (`{ error, ...meta }`) uniform across the
 * whole surface — audit finding: 76 of 94 routes bypassed this file
 * and shipped their own inline responses. Phase 1.2b migrates them.
 *
 * Success shape:  arbitrary JSON body (caller chooses)
 * Error shape:    { error: string, ...extra }  (never nested)
 */

// ─── Auth ─────────────────────────────────────────────────────────

/**
 * Resolve the authenticated user for an API route. V0.2 returns name
 * as well as id so activity logging can attribute every event to a
 * real person.
 *
 * Usage:
 *   const auth = await requireUser();
 *   if (auth.response) return auth.response;   // early return
 *   const { userId, userName } = auth;         // safe to use
 */
export async function requireUser(): Promise<
  | { userId: string; userName: string; response?: never }
  | { userId?: never; userName?: never; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }
  return {
    userId: session.user.id,
    userName: session.user.name ?? "Someone",
  };
}

// ─── Success responses ────────────────────────────────────────────

/** 200 OK with an arbitrary JSON body. */
export function ok<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 200 });
}

/** 201 Created — for POST endpoints that mint a new resource. */
export function created<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 201 });
}

/** 204 No Content — for successful DELETE / idempotent PUT with no body. */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ─── Error responses ──────────────────────────────────────────────

/** 400 Bad Request — malformed body or failed Zod parse. */
export function badRequest(message: string, fieldErrors?: unknown): NextResponse {
  return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
}

/** 401 Unauthorized — no valid session (also used by `requireUser`). */
export function unauthorized(message = "Unauthorized."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** 403 Forbidden — caller is authenticated but lacks permission. */
export function forbidden(message = "Not allowed."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** 404 Not Found — resource missing, or hidden by access filter. */
export function notFound(message = "Not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** 409 Conflict — unique-constraint clash, stale write, etc. */
export function conflict(message = "Conflict."): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

/** 500 Internal Server Error — unexpected. Should be paired with a log. */
export function serverError(message = "Something went wrong."): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}
