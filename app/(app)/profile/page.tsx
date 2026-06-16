import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectsForUser } from "@/lib/server-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, MapPin, Phone, Globe, Languages } from "lucide-react";
import { ROLE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";
import { ProfileEditSheet } from "@/components/profile/profile-edit-sheet";
import {
  computeProfileCompletion,
  EXPERIENCE_LEVELS,
  COMMON_LANGUAGES,
} from "@/lib/profile-completion";

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

  const userId = session.user.id;
  const [user, projects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
        primaryRole: true,
        additionalRoles: true,
        experienceLevel: true,
        location: true,
        languages: true,
        contactPhone: true,
        contactWebsite: true,
        portfolioLinks: true,
      },
    }),
    getProjectsForUser(userId),
  ]);

  if (!user) redirect("/login");

  const name = user.name ?? "User";
  const email = user.email ?? "";
  const initials = initialsFrom(name);
  const rolesHeld = [...new Set(projects.map((p) => p.memberRole))];

  const portfolio =
    Array.isArray(user.portfolioLinks)
      ? (user.portfolioLinks as { title: string; url: string }[])
      : [];

  const completion = computeProfileCompletion({
    profileImage: user.profileImage,
    primaryRole: user.primaryRole,
    additionalRoles: user.additionalRoles,
    experienceLevel: user.experienceLevel,
    location: user.location,
    languages: user.languages,
    contactPhone: user.contactPhone,
    contactWebsite: user.contactWebsite,
    portfolioLinks: user.portfolioLinks,
  });

  const expLabel =
    EXPERIENCE_LEVELS.find((e) => e.value === user.experienceLevel)?.label ??
    null;

  const profileForSheet = {
    name,
    profileImage: user.profileImage,
    primaryRole: user.primaryRole,
    additionalRoles: user.additionalRoles,
    experienceLevel: user.experienceLevel,
    location: user.location,
    languages: user.languages,
    contactPhone: user.contactPhone,
    contactWebsite: user.contactWebsite,
    portfolioLinks: portfolio,
  };

  return (
    <div className="px-8 py-7 max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1.5">
            Your professional identity.
          </p>
        </div>
        <ProfileEditSheet
          profile={profileForSheet}
          trigger={
            <Button variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit profile
            </Button>
          }
        />
      </header>

      {/* Identity card */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-16 w-16">
            {user.profileImage && <AvatarImage src={user.profileImage} alt={name} />}
            <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight truncate">
              {name}
            </h2>
            <p className="text-muted-foreground text-sm truncate">{email}</p>
            {user.primaryRole && (
              <div className="mt-1.5 text-sm">
                <span className="text-foreground/80">
                  {ROLE_LABELS[user.primaryRole] ?? user.primaryRole}
                </span>
                {expLabel && (
                  <span className="text-muted-foreground"> · {expLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Profile</div>
            <div className="text-2xl font-semibold tabular-nums">
              {completion.percent}%
            </div>
          </div>
        </div>
      </div>

      {/* Talent details */}
      {(user.location ||
        user.languages.length > 0 ||
        user.contactPhone ||
        user.contactWebsite ||
        user.additionalRoles.length > 0) && (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6 space-y-4">
          <h3 className="text-base font-semibold">About</h3>
          {user.additionalRoles.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Also plays
              </div>
              <div className="flex flex-wrap gap-2">
                {user.additionalRoles.map((r) => (
                  <Badge
                    key={r}
                    variant="outline"
                    className="bg-white/[0.04] border-white/[0.06]"
                  >
                    {ROLE_LABELS[r] ?? r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {user.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {user.location}
              </div>
            )}
            {user.languages.length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Languages className="h-4 w-4" />
                {user.languages
                  .map(
                    (c) =>
                      COMMON_LANGUAGES.find((l) => l.value === c)?.label ?? c
                  )
                  .join(", ")}
              </div>
            )}
            {user.contactPhone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {user.contactPhone}
              </div>
            )}
            {user.contactWebsite && (
              <a
                href={user.contactWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline truncate"
              >
                <Globe className="h-4 w-4" /> {user.contactWebsite}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
          <h3 className="text-base font-semibold mb-3">Portfolio</h3>
          <div className="space-y-2">
            {portfolio.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] px-3 py-2"
              >
                <div className="text-sm">{l.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {l.url}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Roles played on projects */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
        <h3 className="text-base font-semibold">Roles on Projects</h3>
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
                  <Badge
                    variant="outline"
                    className="bg-white/[0.04] border-white/[0.06] shrink-0"
                  >
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
