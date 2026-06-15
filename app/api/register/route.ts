import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 }
      );
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

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid registration data." },
        { status: 400 }
      );
    }
    console.error("[register] error:", err);
    // In production we surface a short, safe error code so the user can
    // tell the next failure apart from a generic 500. Real details still
    // go to Vercel function logs via console.error.
    const message =
      err instanceof Error ? err.message.slice(0, 200) : "Registration failed.";
    return NextResponse.json(
      { error: "Registration failed.", detail: message },
      { status: 500 }
    );
  }
}
