import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import { canManageCast } from "@/lib/permissions";
import { CastPanel } from "@/components/cast/cast-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * V0.25 — Cast list page.
 * Everyone in the project can view; casting authors can add/edit.
 */
export default async function CastPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  if (!(await userHasProjectAccess(session.user.id, id))) notFound();

  const [project, canManage, departments] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: { currency: true },
    }),
    canManageCast({ userId: session.user.id, projectId: id }),
    prisma.department.findMany({
      where: { projectId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
  ]);

  return (
    <CastPanel
      projectId={id}
      canManage={canManage}
      currency={project?.currency ?? "SAR"}
      departments={departments}
    />
  );
}
