import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess, userIsProjectOwner } from "@/lib/access";
import { MembersPanel } from "@/components/projects/members-panel";
import type {
  MemberRow,
  InvitationRow,
  DepartmentGroup,
} from "@/components/projects/members-panel";
import { DEPARTMENTS, getDepartmentForRole } from "@/lib/department-registry";
import { invitableRoles, canManageProjectMembers } from "@/lib/permissions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectMembersPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  // V0.24.1 — Client-side roles can't see the crew roster.
  const { redirectClientOff } = await import("@/lib/client-gate");
  await redirectClientOff({ userId: session.user.id, projectId: id });

  const isOwner = await userIsProjectOwner(session.user.id, id);

  // V0.12.1 — invite + manage are separate authorities:
  //   - canInvite: Owner / EP / Producer / Director / resolved dept head.
  //     Dept heads land here so they can invite their dept's members.
  //   - canManageMembers: Owner / EP / Producer only. Dept heads can't
  //     change other members' roles or remove them at the project level.
  const [invitable, canManageMembers] = await Promise.all([
    invitableRoles({ userId: session.user.id, projectId: id }),
    canManageProjectMembers({ userId: session.user.id, projectId: id }),
  ]);
  const canInvite = invitable.length > 0;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      userId: true,
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!project) notFound();

  const members: MemberRow[] = project.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    isOwner: m.user.id === project.userId,
  }));

  const pendingInvitations = await prisma.projectInvitation.findMany({
    where: { projectId: id, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { inviter: { select: { name: true } } },
  });
  const invitations: InvitationRow[] = pendingInvitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    invitedBy: i.inviter.name,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
  }));

  // V0.10.1 — group members by department registry. Members whose role
  // doesn't match any registry entry fall under "Unassigned".
  const groupsMap = new Map<string, DepartmentGroup>();
  for (const d of DEPARTMENTS) {
    groupsMap.set(d.key, {
      key: d.key,
      label: d.label,
      headRole: d.headRole,
      members: [],
    });
  }
  groupsMap.set("unassigned", {
    key: "unassigned",
    label: "Unassigned",
    headRole: "",
    members: [],
  });
  for (const m of members) {
    if (m.isOwner) {
      // Owner shows under "Production" by default (matches the directive's
      // example where Producer/Director head their departments).
      groupsMap.get("production")?.members.push(m);
      continue;
    }
    const dept = getDepartmentForRole(m.role);
    const k = dept?.key ?? "unassigned";
    groupsMap.get(k)?.members.push(m);
  }
  const departmentGroups = Array.from(groupsMap.values()).filter(
    (g) => g.members.length > 0
  );

  return (
    <div className="pt-2">
      <MembersPanel
        projectId={id}
        isOwner={isOwner}
        canInvite={canInvite}
        canManageMembers={canManageMembers}
        members={members}
        invitations={invitations}
        departmentGroups={departmentGroups}
      />
    </div>
  );
}
