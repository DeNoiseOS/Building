import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartmentDetail } from "@/lib/department-data";
import { userIsProjectOwner } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/roles";
import { canManageDepartmentMembers } from "@/lib/permissions";
import {
  getDepartmentByHeadRole,
  resolveHeadRoleFromPresent,
} from "@/lib/department-registry";
import {
  Building2,
  ListTodo,
  StickyNote,
  ImageIcon,
  Users as UsersIcon,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DepartmentMembersPanel } from "@/components/departments/department-members-panel";

interface PageProps {
  params: Promise<{ id: string; deptId: string }>;
}

export default async function DepartmentDashboardPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, deptId } = await params;
  const department = await getDepartmentDetail(session.user.id, id, deptId);
  if (!department) notFound();

  const [isOwner, projectMembers, canManage] = await Promise.all([
    userIsProjectOwner(session.user.id, id),
    prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    canManageDepartmentMembers(
      { userId: session.user.id, projectId: id },
      department.kind
    ),
  ]);

  const departmentUserIds = new Set(department.members.map((m) => m.userId));
  const addableMembers = projectMembers
    .filter((pm) => !departmentUserIds.has(pm.user.id))
    .map((pm) => ({
      id: pm.user.id,
      name: pm.user.name,
      email: pm.user.email,
    }));

  // V0.12 — resolve the runtime head of this department per V0.11 rules:
  // the highest-priority head-candidate role that's actually on the project.
  const registryDept = getDepartmentByHeadRole(department.kind);
  const presentRoles = new Set(projectMembers.map((pm) => pm.role));
  const resolvedHeadRole = registryDept
    ? resolveHeadRoleFromPresent(registryDept.key, presentRoles)
    : null;
  const resolvedHeadUserId = resolvedHeadRole
    ? projectMembers.find((pm) => pm.role === resolvedHeadRole)?.user.id ?? null
    : null;
  void isOwner; // canManage already captures owner authority

  return (
    <div className="space-y-6 pt-2">
      <div>
        <Link
          href={`/projects/${id}/departments`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Departments
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {department.name}
              </h1>
              <Badge
                variant="outline"
                className="bg-white/[0.04] border-white/[0.06] text-foreground/85"
              >
                {ROLE_LABELS[department.kind] ?? department.kind}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Department key: <code>{department.key}</code>
            </p>
          </div>
        </div>
        <Link
          href={`/projects/${id}/departments/${deptId}/discussion`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-sm transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          Discussion
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<UsersIcon className="h-4 w-4" />} label="Members" value={department.memberCount} />
        <Stat icon={<ListTodo className="h-4 w-4" />} label="Open tasks" value={department.openTaskCount} />
        <Stat icon={<StickyNote className="h-4 w-4" />} label="Notes" value={department.noteCount} />
        <Stat icon={<ImageIcon className="h-4 w-4" />} label="References" value={department.referenceCount} />
      </div>

      {/* Members */}
      <DepartmentMembersPanel
        projectId={id}
        departmentId={deptId}
        canManage={canManage}
        members={department.members}
        addableMembers={addableMembers}
        resolvedHeadUserId={resolvedHeadUserId}
        resolvedHeadRole={resolvedHeadRole}
      />

      {/* Open tasks */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Tasks
          </h2>
          <Link
            href={`/projects/${id}/tasks`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="p-2.5">
          {department.tasks.length === 0 ? (
            <div className="px-2.5 py-6 text-sm text-muted-foreground">
              No tasks in this department yet.
            </div>
          ) : (
            <ol className="space-y-0.5">
              {department.tasks.slice(0, 8).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.04]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.status}
                      {t.assignee ? ` · ${t.assignee.name}` : ""}
                    </p>
                  </div>
                  {t.dueDate && (
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(t.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Notes + References */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Recent notes
            </h2>
          </div>
          <div className="p-2.5">
            {department.notes.length === 0 ? (
              <div className="px-2.5 py-6 text-sm text-muted-foreground">
                No notes yet.
              </div>
            ) : (
              <ol className="space-y-0.5">
                {department.notes.map((n) => (
                  <li
                    key={n.id}
                    className="px-2.5 py-2 rounded-lg hover:bg-white/[0.04]"
                  >
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {n.section} · updated{" "}
                      {new Date(n.updatedAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Recent references
            </h2>
          </div>
          <div className="p-2.5">
            {department.references.length === 0 ? (
              <div className="px-2.5 py-6 text-sm text-muted-foreground">
                No references yet.
              </div>
            ) : (
              <ol className="space-y-0.5">
                {department.references.map((r) => (
                  <li
                    key={r.id}
                    className="px-2.5 py-2 rounded-lg hover:bg-white/[0.04]"
                  >
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.section} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold mt-1 tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
