import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import {
  resolveTargetProject,
  targetNotificationRecipients,
  type CommentTargetType,
} from "@/lib/comments";
import { mentionedUserIds } from "@/lib/mentions";
import { isProjectWideRole } from "@/lib/hierarchy";

const TARGET_TYPES: [CommentTargetType, ...CommentTargetType[]] = [
  "task",
  "purchase_request",
  "budget_allocation",
  "note",
  "reference",
  "department_discussion",
  "announcement",
];

const createSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1),
  body: z.string().min(1).max(4000),
  /** V0.7 — optional reply parent (must belong to the same target). */
  parentId: z.string().optional().nullable(),
});

const MENTION_TYPE: Record<string, string> = {
  task: "mention_task",
  purchase_request: "mention_budget",
  budget_allocation: "mention_budget",
  note: "mention_note",
  reference: "mention_reference",
  department_discussion: "mention_discussion",
  announcement: "mention_announcement",
};

/** GET /api/comments?targetType=...&targetId=... */
export async function GET(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  if (!targetType || !targetId) {
    return badRequest("targetType and targetId are required.");
  }

  const target = await resolveTargetProject(targetType, targetId);
  if (!target) return notFound("Target not found.");

  const access = await userHasProjectAccess(guard.userId, target.projectId);
  if (!access) return notFound("Target not found.");

  try {
    const rows = await prisma.comment.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json({
      comments: rows.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        author: c.author,
        body: c.body,
        parentId: c.parentId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[comments.GET]", err);
    return serverError("Failed to load comments.");
  }
}

/** POST — create a comment. Notifies target participants. */
export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  const target = await resolveTargetProject(parsed.data.targetType, parsed.data.targetId);
  if (!target) return notFound("Target not found.");

  const access = await userHasProjectAccess(guard.userId, target.projectId);
  if (!access) return notFound("Target not found.");

  // V0.7 — Department discussion: only members of the department (or
  // project-wide roles / owner) can post. Read access is universal.
  if (parsed.data.targetType === "department_discussion") {
    const [isOwner, member, isInDept] = await Promise.all([
      prisma.project.findFirst({
        where: { id: target.projectId, userId: guard.userId },
        select: { id: true },
      }),
      prisma.projectMember.findFirst({
        where: { projectId: target.projectId, userId: guard.userId },
        select: { role: true },
      }),
      prisma.departmentMember.findFirst({
        where: { departmentId: parsed.data.targetId, userId: guard.userId },
        select: { id: true },
      }),
    ]);
    const dept = await prisma.department.findUnique({
      where: { id: parsed.data.targetId },
      select: { kind: true },
    });
    const byKind = member && dept && member.role === dept.kind;
    const projectWide = member && isProjectWideRole(member.role);
    if (!isOwner && !isInDept && !byKind && !projectWide) {
      return forbidden("Only department members can post here.");
    }
  }

  // Validate parent (must be on the same target).
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { targetType: true, targetId: true },
    });
    if (
      !parent ||
      parent.targetType !== parsed.data.targetType ||
      parent.targetId !== parsed.data.targetId
    ) {
      return badRequest("Parent comment doesn't belong to this thread.");
    }
  }

  try {
    const created = await prisma.comment.create({
      data: {
        projectId: target.projectId,
        authorId: guard.userId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        body: parsed.data.body.trim(),
        parentId: parsed.data.parentId ?? null,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    // V0.7 — discussion comments emit their own activity types.
    const isDiscussion = parsed.data.targetType === "department_discussion";
    const isReply = !!parsed.data.parentId;
    await logActivity({
      projectId: target.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: isDiscussion
        ? isReply
          ? "discussion_reply"
          : "discussion_created"
        : "comment_created",
      message: isDiscussion
        ? isReply
          ? `replied in a department discussion.`
          : `started a department discussion.`
        : `commented on a ${parsed.data.targetType.replace("_", " ")}.`,
      metadata: {
        commentId: created.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        parentId: parsed.data.parentId ?? null,
      },
    });

    const targetLink = linkForTarget(
      target.projectId,
      parsed.data.targetType,
      parsed.data.targetId
    );

    const recipients = await targetNotificationRecipients(
      parsed.data.targetType,
      parsed.data.targetId
    );

    // V0.7 — discussion replies notify the parent author + previously-
    // engaged commenters in the same thread.
    if (isReply && parsed.data.parentId) {
      const threadCommentIds = await prisma.comment.findMany({
        where: {
          OR: [
            { id: parsed.data.parentId },
            { parentId: parsed.data.parentId },
          ],
        },
        select: { authorId: true },
      });
      threadCommentIds.forEach((c) => recipients.push(c.authorId));
    }

    await notifyMany(recipients, {
      type: isDiscussion
        ? isReply
          ? "discussion_reply"
          : "discussion_created"
        : "comment_created",
      title: `${guard.userName} ${isDiscussion ? (isReply ? "replied" : "posted") : "commented"}`,
      body: created.body.slice(0, 140),
      link: targetLink,
      metadata: {
        commentId: created.id,
        projectId: target.projectId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      },
      skipUserId: guard.userId,
    });

    // V0.7 — mention dispatch.
    const mentioned = mentionedUserIds(created.body);
    if (mentioned.length > 0) {
      // Only notify users who actually have access to the project.
      const valid = await prisma.projectMember.findMany({
        where: {
          projectId: target.projectId,
          userId: { in: mentioned },
        },
        select: { userId: true, user: { select: { name: true } } },
      });
      const mentionType =
        MENTION_TYPE[parsed.data.targetType] ?? "mention_task";
      await notifyMany(
        valid.map((v) => v.userId),
        {
          type: mentionType as
            | "mention_task"
            | "mention_budget"
            | "mention_note"
            | "mention_reference"
            | "mention_announcement"
            | "mention_discussion",
          title: `${guard.userName} mentioned you`,
          body: created.body.slice(0, 140),
          link: targetLink,
          metadata: {
            commentId: created.id,
            projectId: target.projectId,
            targetType: parsed.data.targetType,
            targetId: parsed.data.targetId,
          },
          skipUserId: guard.userId,
        }
      );
      if (valid.length > 0) {
        await logActivity({
          projectId: target.projectId,
          actorId: guard.userId,
          actorName: guard.userName,
          type: "mention_created",
          message: `mentioned ${valid.length} member${valid.length === 1 ? "" : "s"}.`,
          metadata: {
            commentId: created.id,
            targetType: parsed.data.targetType,
            targetId: parsed.data.targetId,
            mentionedUserIds: valid.map((v) => v.userId),
          },
        });
      }
    }

    return NextResponse.json(
      {
        id: created.id,
        authorId: created.authorId,
        author: created.author,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[comments.POST]", err);
    return serverError("Failed to post comment.");
  }
}

function linkForTarget(projectId: string, targetType: string, targetId: string) {
  if (targetType === "task") return `/projects/${projectId}/tasks`;
  if (targetType === "purchase_request") return `/projects/${projectId}/budget`;
  if (targetType === "budget_allocation") return `/projects/${projectId}/budget`;
  if (targetType === "note") return `/projects/${projectId}/workspace`;
  if (targetType === "reference") return `/projects/${projectId}/workspace`;
  if (targetType === "department_discussion")
    return `/projects/${projectId}/departments/${targetId}/discussion`;
  if (targetType === "announcement")
    return `/projects/${projectId}/announcements`;
  return `/projects/${projectId}`;
}
