import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  listDepartmentsForProject,
  type DepartmentSummary,
} from "@/lib/department-data";
import { userIsProjectOwner } from "@/lib/access";
import { Building2, Users as UsersIcon, ListTodo, ImageIcon, StickyNote } from "lucide-react";
import { DepartmentsHeader } from "@/components/departments/departments-header";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DepartmentsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const departments = await listDepartmentsForProject(session.user.id, id);
  if (departments === null) notFound();

  // V0.24 — Client-side roles don't see Departments (crew-internal).
  const { redirectClientOff } = await import("@/lib/client-gate");
  await redirectClientOff({ userId: session.user.id, projectId: id });

  const isOwner = await userIsProjectOwner(session.user.id, id);

  return (
    <div className="space-y-6 pt-2">
      <DepartmentsHeader projectId={id} isOwner={isOwner} count={departments.length} />

      {departments.length === 0 ? (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No departments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOwner
              ? "Create your first department to start organizing the team."
              : "The project owner hasn't created any departments yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((d) => (
            <DepartmentCard key={d.id} projectId={id} department={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentCard({
  projectId,
  department,
}: {
  projectId: string;
  department: DepartmentSummary;
}) {
  return (
    <Link
      href={`/projects/${projectId}/departments/${department.id}`}
      className="group block rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft hover:shadow-hover transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight truncate leading-tight">
              {department.name}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {department.key}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 text-xs">
        <Stat icon={<UsersIcon className="h-3.5 w-3.5" />} value={department.memberCount} label="people" />
        <Stat icon={<ListTodo className="h-3.5 w-3.5" />} value={department.openTaskCount} label="open" />
        <Stat icon={<StickyNote className="h-3.5 w-3.5" />} value={department.noteCount} label="notes" />
        <Stat icon={<ImageIcon className="h-3.5 w-3.5" />} value={department.referenceCount} label="refs" />
      </div>
    </Link>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <p className="text-base font-semibold tabular-nums leading-tight mt-0.5">
        {value}
      </p>
    </div>
  );
}
