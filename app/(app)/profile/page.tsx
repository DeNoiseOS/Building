import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/server-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";

function initialsFrom(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = session.user.name ?? "User";
  const email = session.user.email ?? "";
  const initials = initialsFrom(name);
  const projects = await getProjectsForUser(session.user.id);
  // V0.4: career identity is "what role does this user play on each project".
  // That's ProjectMember.role — surfaced as `memberRole` on every project DTO.
  const rolesHeld = [...new Set(projects.map((p) => p.memberRole))];

  return (
    <div className="px-8 py-7 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1.5">
          Your professional identity.
        </p>
      </header>

      {/* Identity card */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight truncate">
              {name}
            </h2>
            <p className="text-muted-foreground text-sm truncate">{email}</p>
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
        <h3 className="text-base font-semibold">Professional Roles</h3>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Roles you hold across your productions.
        </p>
        {rolesHeld.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roles yet. Create a project to declare your role on it.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rolesHeld.map((role) => (
              <Badge
                key={role}
                variant="outline"
                className="bg-primary/10 border-primary/20 text-primary"
              >
                {ROLE_LABELS[role] ?? role}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Career */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <h3 className="text-base font-semibold">Career Summary</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Productions you have participated in.
          </p>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">
            Your career record will appear here once you start projects.
          </p>
        ) : (
          <ol className="p-2.5">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <span
                    className={cn(
                      "h-9 w-9 rounded-lg border border-white/10 shrink-0",
                      coverFor(project.id)
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate leading-tight">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ROLE_LABELS[project.memberRole] ?? project.memberRole}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white/[0.04] border-white/[0.06] shrink-0">
                    {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
