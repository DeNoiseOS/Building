"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import type { ProjectChoice } from "./project-switcher";
import type { NotificationData } from "./notification-menu";

interface AppShellProps {
  userName: string;
  userEmail: string;
  projects: ProjectChoice[];
  pendingInvitations: number;
  notifications: NotificationData;
  children: React.ReactNode;
}

/**
 * Client-side shell. Resolves the currently-scoped project from the URL,
 * passes consistent context to the Sidebar and TopBar.
 */
export function AppShell({
  userName,
  userEmail,
  projects,
  pendingInvitations,
  notifications,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/?#]+)/);
  const candidateId = match?.[1] ?? null;
  const active = candidateId
    ? projects.find((p) => p.id === candidateId) ?? null
    : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activeProject={active}
        pendingInvitations={pendingInvitations}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          userName={userName}
          userEmail={userEmail}
          projects={projects}
          activeProjectId={active?.id ?? null}
          notifications={notifications}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
