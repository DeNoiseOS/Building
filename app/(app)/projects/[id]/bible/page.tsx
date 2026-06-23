import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import { canEditBibleSection } from "@/lib/permissions";
import {
  BiblePanel,
  type BibleEntry,
  type DeptOption,
} from "@/components/bible/bible-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * V0.20 — Production Bible. Replaces the old Workspace tab.
 *
 * Pre-computes the list of departments the caller can write to
 * (avoids per-card permission round-trips on the client).
 */
export default async function BiblePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  if (!(await userHasProjectAccess(session.user.id, id))) notFound();

  const departments = await prisma.department.findMany({
    where: { projectId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, kind: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).bibleEntry;
  const rawEntries = m
    ? await m
        .findMany({
          where: { projectId: id },
          include: {
            department: { select: { id: true, name: true, kind: true } },
            addedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        })
        .catch(() => [])
    : [];

  type RawRow = {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    body: string | null;
    type: string;
    pinned: boolean;
    createdAt: Date;
    department: { id: string; name: string; kind: string } | null;
    addedBy: { id: string; name: string } | null;
  };
  const entries: BibleEntry[] = (rawEntries as RawRow[]).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    url: e.url,
    body: e.body,
    type: e.type,
    pinned: e.pinned,
    createdAt: e.createdAt.toISOString(),
    department: e.department,
    addedBy: e.addedBy,
  }));

  // Pre-compute write authority per dept (single pass, no client work).
  const callerCtx = { userId: session.user.id, projectId: id };
  const editableDeptIds: string[] = [];
  for (const d of departments as DeptOption[]) {
    if (await canEditBibleSection(callerCtx, d.kind)) {
      editableDeptIds.push(d.id);
    }
  }
  const canEditDirection = await canEditBibleSection(callerCtx, null);

  return (
    <div className="pt-2">
      <BiblePanel
        projectId={id}
        entries={entries}
        departments={departments as DeptOption[]}
        editableDeptIds={editableDeptIds}
        canEditDirection={canEditDirection}
      />
    </div>
  );
}
