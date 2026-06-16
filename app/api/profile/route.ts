import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { ROLE_VALUES } from "@/lib/roles";
import { EXPERIENCE_LEVEL_VALUES } from "@/lib/profile-completion";

/**
 * V0.12 — Profile read / write.
 *
 * The signed-in user reads and updates their own profile here. Profile
 * fields are the "talent foundation": searchable role, location, and
 * language data plus public-facing contact + portfolio links.
 */

const portfolioLinkSchema = z.object({
  title: z.string().min(1).max(120),
  url: z.string().url().max(500),
});

const patchSchema = z.object({
  name:             z.string().min(1).max(120).optional(),
  profileImage:     z.string().url().max(500).nullable().optional(),
  primaryRole:      z
    .enum(ROLE_VALUES as unknown as [string, ...string[]])
    .nullable()
    .optional(),
  additionalRoles:  z
    .array(z.enum(ROLE_VALUES as unknown as [string, ...string[]]))
    .max(10)
    .optional(),
  experienceLevel:  z
    .enum(EXPERIENCE_LEVEL_VALUES as unknown as [string, ...string[]])
    .nullable()
    .optional(),
  location:         z.string().max(120).nullable().optional(),
  languages:        z.array(z.string().min(2).max(8)).max(20).optional(),
  contactPhone:     z.string().max(40).nullable().optional(),
  contactWebsite:   z.string().url().max(500).nullable().optional(),
  portfolioLinks:   z.array(portfolioLinkSchema).max(20).optional(),
  profileSkippedAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const user = await prisma.user.findUnique({
    where: { id: guard.userId },
    select: {
      id: true,
      name: true,
      email: true,
      profileImage: true,
      primaryRole: true,
      additionalRoles: true,
      experienceLevel: true,
      location: true,
      languages: true,
      contactPhone: true,
      contactWebsite: true,
      portfolioLinks: true,
      profileSkippedAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid profile data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.profileSkippedAt !== undefined) {
      data.profileSkippedAt = parsed.data.profileSkippedAt
        ? new Date(parsed.data.profileSkippedAt)
        : null;
    }
    await prisma.user.update({
      where: { id: guard.userId },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profile.PATCH]", err);
    return serverError("Failed to update profile.");
  }
}
