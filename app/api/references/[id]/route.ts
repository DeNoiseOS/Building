import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, notFound, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { projectAccessFilter } from "@/lib/access";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  link: z.string().max(2000).optional().nullable(),
  section: z.string().min(1).max(100).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadReferenceWithAccess(userId: string, referenceId: string) {
  return prisma.reference.findFirst({
    where: { id: referenceId, project: projectAccessFilter(userId) },
    include: { project: { select: { id: true, role: true } } },
  });
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const reference = await loadReferenceWithAccess(guard.userId, id);
  if (!reference) return notFound("Reference not found.");

  return NextResponse.json({
    id: reference.id,
    projectId: reference.projectId,
    title: reference.title,
    description: reference.description,
    imageUrl: reference.imageUrl,
    link: reference.link,
    section: reference.section,
    createdAt: reference.createdAt.toISOString(),
  });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await loadReferenceWithAccess(guard.userId, id);
  if (!existing) return notFound("Reference not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "Invalid reference data.",
      parsed.error.flatten().fieldErrors
    );
  }

  try {
    const updated = await prisma.reference.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.imageUrl !== undefined && {
          imageUrl: parsed.data.imageUrl,
        }),
        ...(parsed.data.link !== undefined && { link: parsed.data.link }),
        ...(parsed.data.section !== undefined && {
          section: parsed.data.section,
        }),
      },
    });

    const changedFields = Object.keys(parsed.data).filter(
      (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
    );
    if (changedFields.length > 0) {
      await logActivity({
        projectId: updated.projectId,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "reference_updated",
        message: `updated reference '${updated.title}'.`,
        metadata: { referenceId: updated.id, fields: changedFields },
      });
    }

    return NextResponse.json({
      id: updated.id,
      projectId: updated.projectId,
      title: updated.title,
      description: updated.description,
      imageUrl: updated.imageUrl,
      link: updated.link,
      section: updated.section,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[references.PATCH]", err);
    return serverError("Failed to update reference.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await loadReferenceWithAccess(guard.userId, id);
  if (!existing) return notFound("Reference not found.");

  try {
    await prisma.reference.delete({ where: { id } });
    await logActivity({
      projectId: existing.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "reference_deleted",
      message: `deleted reference '${existing.title}'.`,
      metadata: { referenceId: existing.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[references.DELETE]", err);
    return serverError("Failed to delete reference.");
  }
}
