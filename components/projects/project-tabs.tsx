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
// V0.21 — Trimmed to 8 tabs. Removed: Announcements (→ Overview strip),
// Members (→ Departments), Activity (→ Overview widget + Settings),
// Analytics (→ Reports button on Overview + sidebar). Old URLs redirect.
const TABS: TabDef[] = [
  {
    label: "Overview",
    href: (id) => `/projects/${id}`,
    match: (p, id) => p === `/projects/${id}`,
    icon: LayoutDashboard,
  },
  {
    label: "Scenes",
    href: (id) => `/projects/${id}/scenes`,
    match: (p, id) => p.startsWith(`/projects/${id}/scenes`),
    icon: Film,
  },
  {
    label: "Tasks",
    href: (id) => `/projects/${id}/tasks`,
    match: (p, id) => p.startsWith(`/projects/${id}/tasks`),
    icon: ListTodo,
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
    label: "Resources",
    href: (id) => `/projects/${id}/equipment`,
    match: (p, id) => p.startsWith(`/projects/${id}/equipment`),
    icon: Package,
  },
  {
    label: "Production Bible",
    href: (id) => `/projects/${id}/bible`,
    match: (p, id) => p.startsWith(`/projects/${id}/bible`),
    icon: BookOpen,
  },
  {
    label: "Calendar",
    href: (id) => `/projects/${id}/calendar`,
    match: (p, id) => p.startsWith(`/projects/${id}/calendar`),
    icon: CalendarDays,
  },
];

/**
 * V0.24 — Client-side tabs (agency roles).
 * Everything financial or crew-management-related is hidden. The
 * client roles get the creative view only.
 */
const CLIENT_TAB_LABELS = new Set([
  "Overview",
  "Scenes",
  "Production Bible",
  "Calendar",
]);

export function ProjectTabs({
  projectId,
  isClient = false,
}: {
  projectId: string;
  isClient?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/[0.06] -mx-px">
      <ul className="flex items-center gap-1 overflow-x-auto">
        {TABS.filter((t) => (isClient ? CLIENT_TAB_LABELS.has(t.label) : true)).map((tab) => {
          const active = tab.match(pathname, projectId);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href(projectId)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-all whitespace-nowrap",
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
