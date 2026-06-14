import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import { canManageAnnouncement } from "@/lib/announcements";
import { AnnouncementsPanel } from "@/components/announcements/announcements-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnnouncementsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  const [canManage, rows] = await Promise.all([
    canManageAnnouncement({ userId: session.user.id, projectId: id }),
    prisma.announcement.findMany({
      where: {
        projectId: id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: { author: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <AnnouncementsPanel
      projectId={id}
      canManage={canManage}
      currentUser={{
        id: session.user.id,
        name: session.user.name ?? "Me",
      }}
      announcements={rows.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        pinned: a.pinned,
        expiresAt: a.expiresAt?.toISOString() ?? null,
        author: a.author,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }))}
    />
  );
}
