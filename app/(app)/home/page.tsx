import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHomeLayoutForUser } from "@/lib/widgets/layout-server";
import { fetchAllWidgetData } from "@/lib/widgets/data/fetch-all";
import { HomeCanvasClient } from "@/components/home/canvas/home-canvas-client";
import { HomeHeader } from "@/components/home/home-header";
import { prisma } from "@/lib/prisma";

/**
 * V0.28 — Home Command Center.
 *
 * The page is now a thin server shell:
 *   1. Load the user's layout (or the default if none persisted).
 *   2. Batch-resolve every widget's data through its resolver (all
 *      resolvers respect projectAccessFilter).
 *   3. Hand the layout + data map to the client canvas.
 *
 * All the V0.27 bespoke section code is retired in favour of widget
 * renderers — the default layout preserves the same information
 * hierarchy.
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const [layout, activeProjects] = await Promise.all([
    getHomeLayoutForUser(userId),
    prisma.project.findMany({
      where: {
        AND: [
          {
            OR: [
              { userId },
              { members: { some: { userId } } },
            ],
          },
          { status: "active" },
        ],
      },
      orderBy: { endDate: "asc" },
      select: { id: true, name: true },
      take: 12,
    }),
  ]);

  const data = await fetchAllWidgetData(userId, layout.widgets);

  const defaultProject = activeProjects[0] ?? null;
  const now = new Date();

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-7 max-w-[1500px] mx-auto space-y-4">
      <HomeHeader
        firstName={firstName}
        greeting={timeGreeting()}
        activeProjectsCount={activeProjects.length}
        now={now}
        defaultProject={defaultProject}
        projectChoices={activeProjects}
        currentUserId={userId}
        currentUserName={session.user.name ?? "Me"}
        canCreateAnnouncement={false}
        canInviteSomewhere={false}
      />
      <HomeCanvasClient initialLayout={layout} initialData={data} />
    </div>
  );
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
