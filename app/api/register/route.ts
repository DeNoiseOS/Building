import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, created } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return badRequest("An account with this email already exists.");
    }

    const hashed = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        password: hashed,
      },
      select: { id: true, name: true, email: true },
    });

    // V0.2: pending invitations addressed to this email become immediately
    // visible via GET /api/invitations (the lookup is by User.email). No
    // explicit claim is required — accepting still happens through the
    // invitations UI so the user makes the choice.

    return created(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return badRequest("Invalid registration data.");
    }
    log.error("[register] error:", err instanceof Error ? err : { err: String(err) });
    // Preserves the pre-cleanup shape { error, detail } — the frontend
    // may render `detail` to disambiguate 500 causes. Once we're sure
    // nothing consumes `detail`, this can collapse to serverError().
    const message =
      err instanceof Error ? err.message.slice(0, 500) : "Registration failed.";
    return NextResponse.json(
      { error: "Registration failed.", detail: message },
      { status: 500 },
    );
  }
}
