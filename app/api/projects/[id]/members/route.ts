import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, notFound, serverError } from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/members
 * Returns the project's owner + all members. Visible to any member.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        members: {
          orderBy: { joinedAt: "asc" },
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!project) return notFound("Project not found.");

    // The owner is always represented as a member (auto-created at project
    // creation), but we expose an explicit `isOwner` flag for the UI.
    const members = project.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      isOwner: m.user.id === project.userId,
    }));

    return NextResponse.json({ members });
  } catch (err) {
    console.error("[projects.members.GET]", err);
    return serverError("Failed to load members.");
  }
}
