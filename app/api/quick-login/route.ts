import { NextResponse } from "next/server";
import { z } from "zod";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLE_VALUES, ROLE_LABELS } from "@/lib/roles";

/**
 * V0.26 — Quick login (testing only).
 *
 * Two modes:
 *   1. { userId }               — pick an existing user
 *   2. { name, role, email? }   — create OR match a user by name; used
 *                                  when you want to type a persona name
 *
 * Returns a short-lived JWT that the `quicklogin` NextAuth provider
 * verifies. The client then calls signIn("quicklogin", { token }) to
 * open a session.
 *
 * Gated by NEXT_PUBLIC_QUICK_LOGIN=1. In production without that env
 * this endpoint always returns 404.
 */

const bodySchema = z
  .object({
    userId: z.string().min(1).optional(),
    /** V0.26.1 — the primary mode. Sign in as the shared persona for
     * this role. Persona name is derived from the role label. */
    role: z.string().min(1).optional(),
    /** Legacy mode: create a custom name + role persona. Kept for the
     * "New persona" form. */
    name: z.string().min(1).max(80).optional(),
    email: z.string().email().optional(),
  })
  .refine(
    (d) => !!d.userId || !!d.role || (!!d.name && !!d.role),
    "Provide userId or role."
  );

function slugName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

/**
 * V0.26.1 — Ensure the shared persona for a role exists; return its id.
 * Persona email is `role-slug@personas.local` so re-signing in as
 * that role always resolves to the same user across every project.
 */
async function ensureRolePersona(role: string): Promise<string> {
  const label = ROLE_LABELS[role] ?? role;
  const email = `${role.replace(/_/g, "-")}@personas.local`;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;
  const password = await bcrypt.hash(
    Math.random().toString(36) + Date.now().toString(36),
    4
  );
  const created = await prisma.user.create({
    data: {
      name: `The ${label}`,
      email,
      password,
      primaryRole: role,
    },
  });
  return created.id;
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") {
    return NextResponse.json(
      { error: "Quick login isn't enabled on this deployment." },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] ?? "Invalid payload." },
      { status: 400 }
    );
  }

  let userId: string;

  if (parsed.data.userId) {
    // Mode 1: pick existing.
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    userId = user.id;
  } else if (parsed.data.role && !parsed.data.name) {
    // V0.26.1 — Mode 2 (primary): role-only. Uses the shared "The X"
    // persona for this role. Auto-derives the name from the role label
    // and gives it a stable email so re-signing in as this role always
    // lands on the same account.
    const role = parsed.data.role.trim();
    if (!ROLE_VALUES.includes(role as (typeof ROLE_VALUES)[number])) {
      return NextResponse.json(
        { error: `Unknown role: ${role}` },
        { status: 400 }
      );
    }
    userId = await ensureRolePersona(role);
  } else {
    // Mode 3: name + role. Optional email; auto-generate if not given.
    const name = parsed.data.name!.trim();
    const role = parsed.data.role!.trim();
    if (!ROLE_VALUES.includes(role as (typeof ROLE_VALUES)[number])) {
      return NextResponse.json(
        { error: `Unknown role: ${role}` },
        { status: 400 }
      );
    }
    const email =
      parsed.data.email?.trim() ?? `${slugName(name)}@quick.local`;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      userId = existing.id;
      // Update primaryRole if it changed (keeps testing consistent).
      await prisma.user.update({
        where: { id: existing.id },
        data: { primaryRole: role },
      });
    } else {
      // Create a fresh user. Password is a random string they never see;
      // quick-login sessions bypass password anyway.
      const password = await bcrypt.hash(
        Math.random().toString(36) + Date.now().toString(36),
        4
      );
      const created = await prisma.user.create({
        data: {
          name,
          email,
          password,
          primaryRole: role,
        },
      });
      userId = created.id;
    }
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTH_SECRET not set on this deployment." },
      { status: 500 }
    );
  }

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, userId });
}
