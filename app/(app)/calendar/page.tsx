import { redirect } from "next/navigation";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import { auth } from "@/lib/auth";
import { getCalendarEventsForUser } from "@/lib/server-data";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { MonthNav } from "@/components/calendar/month-nav";
import { CalendarDays } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ m?: string }>;
}

function parseMonthParam(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = parse(value, "yyyy-MM", new Date());
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { m } = await searchParams;
  const monthDate = parseMonthParam(m);
  // Pad the range a bit to include leading / trailing week.
  const events = await getCalendarEventsForUser(
    session.user.id,
    startOfMonth(monthDate),
    endOfMonth(monthDate)
  );

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <CalendarDays className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          </div>
          <p className="text-muted-foreground mt-1.5">
            Shoot days, deadlines, and key dates across all your productions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">
            {format(monthDate, "MMMM yyyy")}
          </span>
          <MonthNav monthDate={monthDate} />
        </div>
      </header>

      <CalendarGrid events={events} monthDate={monthDate} />
    </div>
  );
}
