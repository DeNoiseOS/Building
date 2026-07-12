"use client";

import { format } from "date-fns";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthBadge } from "@/components/shared/health-badge";
import { ROLE_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";
import { ProjectActionsMenu } from "./project-actions-menu";
import type { ProjectHealth } from "@/lib/project-stats";

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    /** Legacy: project's headline role (Project.role). Not displayed. */
    role: string;
    /** V0.4: the current viewer's role on the project. Displayed in the badge. */
    memberRole: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  health: ProjectHealth;
  canEdit?: boolean;
  canDelete?: boolean;
  /** V0.21 — show the Reports button (admin only). */
  canViewReports?: boolean;
  /** V0.26.3 — Server-rendered "Reset sandbox" button slot. */
  resetButton?: React.ReactNode;
}

export function ProjectHeader({
  project,
  health,
  canEdit = false,
  canDelete = false,
  canViewReports = false,
  resetButton = null,
}: ProjectHeaderProps) {
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  const palette = coverFor(project.id);

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div
            className={cn(
              "h-14 w-14 rounded-xl shrink-0 border border-white/10 shadow-soft",
              palette
            )}
          />
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">
                {project.name}
              </h1>
              {project.status === "archived" && (
                <Badge variant="outline" className="bg-white/[0.04]">
                  Archived
                </Badge>
              )}
              <HealthBadge health={health} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className="bg-white/[0.04] border-white/[0.06]"
              >
                {ROLE_LABELS[project.memberRole] ?? project.memberRole}
              </Badge>
              <span>
                {format(start, "MMM d, yyyy")} → {format(end, "MMM d, yyyy")}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-foreground/80 max-w-3xl">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {resetButton}
          {canViewReports && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/projects/${project.id}/reports`}>
                <BarChart3 className="h-3.5 w-3.5" />
                Reports
              </Link>
            </Button>
          )}
          {(canEdit || canDelete) && (
            <ProjectActionsMenu
              project={project}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
        </div>
      </div>
    </header>
  );
}
