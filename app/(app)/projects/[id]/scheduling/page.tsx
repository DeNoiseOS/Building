import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { ClipboardList, MapPin, Clock, Film, Timer } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { canManageScene } from "@/lib/permissions";
import { getShootDaysForProject } from "@/lib/scheduling/data";
import { NewShootDayButton } from "@/components/scheduling/new-shoot-day-button";

/**
 * V0.29 — Scheduling: shoot-day list page.
 */
export default async function SchedulingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const project = await prisma.project.findFirst({
    where: { AND: [projectAccessFilter(userId), { id: projectId }] },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const [days, canEdit] = await Promise.all([
    getShootDaysForProject(userId, projectId),
    canManageScene({ userId, projectId }),
  ]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-[var(--denoise-copper-muted)] border border-[var(--denoise-copper-border)] flex items-center justify-center text-[var(--denoise-copper)]">
              <ClipboardList className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--denoise-cream)]">
              Scheduling
            </h1>
          </div>
          <p className="text-[13px] text-[var(--denoise-cream-muted)] mt-1">
            Plan shoot days and produce call sheets.
          </p>
        </div>
        {canEdit && <NewShootDayButton projectId={projectId} />}
      </header>

      {days.length === 0 ? (
        <div className="rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)] px-6 py-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--denoise-copper)]">
            Nothing yet
          </p>
          <h3 className="mt-2 text-base font-medium text-[var(--denoise-cream)]">
            Build your first shoot day.
          </h3>
          <p className="mt-1 text-[12px] text-[var(--denoise-cream-muted)]">
            Add a date, pick which scenes get shot, then export a full call sheet.
          </p>
        </div>
      ) : (
        <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {days.map((d) => (
            <li key={d.id}>
              <Link
                href={`/projects/${projectId}/scheduling/${d.id}`}
                className="block rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)] hover:border-[var(--denoise-border-strong)] transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-copper)]">
                      {format(d.date, "EEEE")}
                    </p>
                    <h3 className="text-xl font-medium text-[var(--denoise-cream)] mt-1 tabular-nums">
                      {format(d.date, "MMM d, yyyy")}
                    </h3>
                    {d.label && (
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-1">
                        {d.label}
                      </p>
                    )}
                  </div>
                  {d.generalCallTime && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)]">
                        Call
                      </p>
                      <p className="text-[13px] tabular-nums text-[var(--denoise-cream)]">
                        {d.generalCallTime}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--denoise-border)] flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--denoise-cream-muted)]">
                  {d.locationName && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {d.locationName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Film className="h-3 w-3" />
                    {d.sceneCount} scene{d.sceneCount === 1 ? "" : "s"}
                  </span>
                  {d.estimatedTotalMinutes > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {Math.floor(d.estimatedTotalMinutes / 60)}h{" "}
                      {d.estimatedTotalMinutes % 60}m est.
                    </span>
                  )}
                  {d.wrapTime && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Wrap {d.wrapTime}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
