"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Activity as ActivityIcon,
  BarChart3,
  LayoutPanelTop,
  Settings,
  Sliders,
  Clapperboard,
  Palette,
  Camera,
  Film,
  MapPin,
  Users,
  Inbox,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional active matcher; defaults to exact-or-prefix on href. */
  match?: (pathname: string) => boolean;
  /** Optional numeric badge (rendered when > 0). */
  badge?: number;
}

interface SidebarProject {
  id: string;
  name: string;
  /** Project's headline role (Project.role). */
  role: string;
  /** V0.3: caller's ProjectMember.role for this project. */
  memberRole: string;
}

interface SidebarProps {
  activeProject: SidebarProject | null;
  /** Pending invitation count for the authenticated user. */
  pendingInvitations: number;
}

// Hardcoded department list — V0.1 presentation of the V1.0+ multi-workspace
// vision. All items currently route to the project's workspace page.
const WORKSPACE_DEPARTMENTS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  /** Role values that activate this department for the current project. */
  activeForRoles: string[];
}> = [
  { key: "director", label: "Director", icon: Clapperboard, activeForRoles: ["director"] },
  { key: "art", label: "Art Department", icon: Palette, activeForRoles: ["art_director"] },
  { key: "camera", label: "Camera Department", icon: Camera, activeForRoles: [] },
  { key: "post", label: "Post Production", icon: Film, activeForRoles: [] },
  { key: "locations", label: "Locations", icon: MapPin, activeForRoles: [] },
  { key: "cast", label: "Cast & Talent", icon: Users, activeForRoles: ["assistant_director"] },
];

export function Sidebar({ activeProject, pendingInvitations }: SidebarProps) {
  const pathname = usePathname();

  // V0.8 — order per directive: Home leads, then Dashboard / Tasks / Calendar
  // / Activity / Reports, then global Projects + my-tasks + inbox.
  const globalNav: NavItem[] = [
    { label: "Home", href: "/home", icon: Home },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Activity", href: "/activity", icon: ActivityIcon },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "My Tasks", href: "/tasks?mine=1", icon: UserCheck },
    { label: "Inbox", href: "/inbox", icon: Inbox, badge: pendingInvitations },
  ];

  const projectNav: NavItem[] = activeProject
    ? [
        {
          label: "Dashboard",
          href: `/projects/${activeProject.id}`,
          icon: Home,
          match: (p) => p === `/projects/${activeProject.id}`,
        },
        {
          label: "Tasks",
          href: `/projects/${activeProject.id}/tasks`,
          icon: ListTodo,
        },
        {
          label: "Calendar",
          href: `/projects/${activeProject.id}/calendar`,
          icon: CalendarDays,
        },
        {
          label: "Activity",
          href: `/projects/${activeProject.id}/activity`,
          icon: ActivityIcon,
        },
        {
          label: "Reports",
          href: `/projects/${activeProject.id}/reports`,
          icon: BarChart3,
        },
      ]
    : [];

  const isItemActive = (item: NavItem) =>
    item.match
      ? item.match(pathname)
      : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-white/[0.04] flex flex-col">
      {/* Brand */}
      <div className="h-14 px-5 flex items-center">
        <Link
          href="/home"
          className="flex items-center gap-2 group"
        >
          <span className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-soft">
            <Clapperboard className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            ProductionOS
          </span>
        </Link>
      </div>

      {/* Context Header */}
      {activeProject ? (
        <Link
          href={`/projects/${activeProject.id}`}
          className="mx-3 mt-1 mb-3 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "h-9 w-9 rounded-lg shrink-0 border border-white/10",
                coverFor(activeProject.id)
              )}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">
                {activeProject.name}
              </p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                {ROLE_LABELS[activeProject.memberRole] ??
                  activeProject.memberRole}
              </p>
            </div>
          </div>
        </Link>
      ) : (
        <div className="mx-3 mt-1 mb-3 px-2.5 py-2 text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
          All Projects
        </div>
      )}

      {/* Primary navigation */}
      <nav className="px-3 space-y-0.5">
        {(activeProject ? projectNav : globalNav).map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/75 hover:text-foreground hover:bg-white/[0.04]"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    "ml-auto inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-primary/25 text-primary"
                      : "bg-primary/20 text-primary"
                  )}
                  aria-label={`${item.badge} pending`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Workspaces (project context only) */}
      {activeProject && (
        <div className="px-3 mt-6">
          <div className="px-2.5 mb-1.5 flex items-center gap-1.5">
            <LayoutPanelTop className="h-3 w-3 text-muted-foreground/70" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">
              Workspaces
            </span>
          </div>
          <nav className="space-y-0.5">
            {WORKSPACE_DEPARTMENTS.map((dept) => {
              const Icon = dept.icon;
              const isAvailable = dept.activeForRoles.includes(
                activeProject.memberRole
              );
              const inWorkspace = pathname.startsWith(
                `/projects/${activeProject.id}/workspace`
              );
              const active = inWorkspace && isAvailable;
              return (
                <Link
                  key={dept.key}
                  href={
                    isAvailable
                      ? `/projects/${activeProject.id}/workspace`
                      : `/projects/${activeProject.id}/workspace`
                  }
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : isAvailable
                        ? "text-foreground/75 hover:text-foreground hover:bg-white/[0.04]"
                        : "text-foreground/35 hover:text-foreground/55 hover:bg-white/[0.02]"
                  )}
                  title={
                    isAvailable
                      ? `${dept.label} workspace`
                      : `${dept.label} — coming in a future version`
                  }
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      active && "text-primary",
                      !isAvailable && "opacity-60"
                    )}
                  />
                  <span className="truncate">{dept.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <div className="flex-1" />

      {/* Footer — Settings + Customize */}
      <nav className="px-3 pb-3 space-y-0.5 border-t border-white/[0.04] pt-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-white/[0.05] text-foreground"
              : "text-foreground/75 hover:text-foreground hover:bg-white/[0.04]"
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
        <Link
          href="/customize"
          className={cn(
            "flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-sm transition-colors",
            pathname.startsWith("/customize")
              ? "bg-white/[0.05] text-foreground"
              : "text-foreground/75 hover:text-foreground hover:bg-white/[0.04]"
          )}
        >
          <Sliders className="h-4 w-4" />
          <span>Customize</span>
        </Link>
      </nav>
    </aside>
  );
}
