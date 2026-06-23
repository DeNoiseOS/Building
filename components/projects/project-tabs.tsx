"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  LayoutPanelTop,
  BookOpen,
  CalendarDays,
  Activity as ActivityIcon,
  BarChart3,
  Users as UsersIcon,
  Building2,
  DollarSign,
  Megaphone,
  Package,
  Film,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabDef {
  label: string;
  href: (id: string) => string;
  match: (pathname: string, id: string) => boolean;
  icon: LucideIcon;
}

/**
 * Project-level tabs. Extensible by appending to TABS — new tabs in future
 * versions append without restructuring. Order is presentation.
 */
const TABS: TabDef[] = [
  {
    label: "Overview",
    href: (id) => `/projects/${id}`,
    match: (p, id) => p === `/projects/${id}`,
    icon: LayoutDashboard,
  },
  {
    label: "Tasks",
    href: (id) => `/projects/${id}/tasks`,
    match: (p, id) => p.startsWith(`/projects/${id}/tasks`),
    icon: ListTodo,
  },
  {
    // V0.17 — Scene Planning
    label: "Scenes",
    href: (id) => `/projects/${id}/scenes`,
    match: (p, id) => p.startsWith(`/projects/${id}/scenes`),
    icon: Film,
  },
  {
    // V0.20 — renamed from "Workspace". Cross-dept reference library.
    label: "Production Bible",
    href: (id) => `/projects/${id}/bible`,
    match: (p, id) => p.startsWith(`/projects/${id}/bible`),
    icon: BookOpen,
  },
  {
    label: "Announcements",
    href: (id) => `/projects/${id}/announcements`,
    match: (p, id) => p.startsWith(`/projects/${id}/announcements`),
    icon: Megaphone,
  },
  {
    label: "Departments",
    href: (id) => `/projects/${id}/departments`,
    match: (p, id) => p.startsWith(`/projects/${id}/departments`),
    icon: Building2,
  },
  {
    label: "Budget",
    href: (id) => `/projects/${id}/budget`,
    match: (p, id) => p.startsWith(`/projects/${id}/budget`),
    icon: DollarSign,
  },
  {
    // V0.10.1 — the underlying URL stays /equipment for back-compat;
    // the surface is now labelled "Resources" because the tab spans
    // department-specific kinds (equipment, props, talent, …).
    label: "Resources",
    href: (id) => `/projects/${id}/equipment`,
    match: (p, id) => p.startsWith(`/projects/${id}/equipment`),
    icon: Package,
  },
  {
    label: "Calendar",
    href: (id) => `/projects/${id}/calendar`,
    match: (p, id) => p.startsWith(`/projects/${id}/calendar`),
    icon: CalendarDays,
  },
  {
    label: "Members",
    href: (id) => `/projects/${id}/members`,
    match: (p, id) => p.startsWith(`/projects/${id}/members`),
    icon: UsersIcon,
  },
  {
    label: "Activity",
    href: (id) => `/projects/${id}/activity`,
    match: (p, id) => p.startsWith(`/projects/${id}/activity`),
    icon: ActivityIcon,
  },
  {
    // V0.15 — was "Reports" placeholder; now hosts the Analytics dashboard.
    label: "Analytics",
    href: (id) => `/projects/${id}/reports`,
    match: (p, id) => p.startsWith(`/projects/${id}/reports`),
    icon: BarChart3,
  },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/[0.06] -mx-px">
      <ul className="flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.match(pathname, projectId);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href(projectId)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-all",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
