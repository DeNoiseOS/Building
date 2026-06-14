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

  const events = await getCalendarEventsForUser(
    session.user.id,
    startOfMonth(monthDate),
    endOfMonth(monthDate),
    project.id,
    deptFilter
  );

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
