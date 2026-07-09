import { notFound, redirect } from "next/navigation";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import { auth } from "@/lib/auth";
import {
  getProjectForUser,
  getCalendarEventsForUser,
  getProjectDepartmentFilterContext,
} from "@/lib/server-data";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { MonthNav } from "@/components/calendar/month-nav";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { parseDeptFilter } from "@/lib/department-filter";
import { CalendarDays } from "lucide-react";
import { isClientCaller } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; dept?: string }>;
}

function parseMonthParam(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = parse(value, "yyyy-MM", new Date());
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function ProjectCalendarPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { m, dept: deptParam } = await searchParams;
  const monthDate = parseMonthParam(m);

  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  const deptFilter = parseDeptFilter(deptParam);
  const filterCtx = await getProjectDepartmentFilterContext(
    session.user.id,
    project.id
  );

  // V0.24 — Client-side roles get the CREATIVE calendar only:
  // pending creative approvals + decided approvals as events. No
  // task deadlines, no crew calls, no dept scheduling noise.
  const isClient = await isClientCaller({
    userId: session.user.id,
    projectId: id,
  });

  let events: Awaited<ReturnType<typeof getCalendarEventsForUser>>;
  if (isClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).creativeApproval;
    const rows = m
      ? await m
          .findMany({
            where: {
              projectId: id,
              requestedAt: {
                gte: startOfMonth(monthDate),
                lte: endOfMonth(monthDate),
              },
            },
            include: {
              scene: { select: { number: true, title: true } },
            },
          })
          .catch(() => [])
      : [];
    type Row = {
      id: string;
      title: string;
      status: string;
      requestedAt: Date;
      scene: { number: string; title: string } | null;
    };
    events = (rows as Row[]).map((r) => ({
      id: r.id,
      title: r.scene
        ? `${r.title} — Scene #${r.scene.number}`
        : r.title,
      date: r.requestedAt.toISOString(),
      kind: "creative_approval",
      status: r.status,
    })) as unknown as Awaited<ReturnType<typeof getCalendarEventsForUser>>;
  } else {
    events = await getCalendarEventsForUser(
      session.user.id,
      startOfMonth(monthDate),
      endOfMonth(monthDate),
      project.id,
      deptFilter
    );
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Calendar</h2>
            <p className="text-sm text-muted-foreground">
              Key dates for this production.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DepartmentFilter
            departments={filterCtx.departments}
            hasOwnDepartments={filterCtx.myDepartmentIds.length > 0}
          />
          <span className="text-base font-semibold tracking-tight">
            {format(monthDate, "MMMM yyyy")}
          </span>
          <MonthNav monthDate={monthDate} />
        </div>
      </div>

      <CalendarGrid events={events} monthDate={monthDate} />
    </div>
  );
}
