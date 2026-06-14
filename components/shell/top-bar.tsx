"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, LogOut, User, Settings, Command } from "lucide-react";
import { NotificationMenu, type NotificationData } from "./notification-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ProjectSwitcher,
  type ProjectChoice,
} from "./project-switcher";

interface TopBarProps {
  userName: string;
  userEmail: string;
  projects: ProjectChoice[];
  activeProjectId: string | null;
  notifications: NotificationData;
}

function initialsFrom(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({
  userName,
  userEmail,
  projects,
  activeProjectId,
  notifications,
}: TopBarProps) {
  const router = useRouter();
  const initials = initialsFrom(userName || "U");

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 px-5 border-b border-white/[0.04] flex items-center gap-3">
      {/* Left: search (visual only for V0.1) */}
      <div className="hidden md:flex items-center gap-2 h-9 w-72 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-muted-foreground/70 text-sm">
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Search…</span>
        <div className="ml-auto flex items-center gap-0.5 text-[10px]">
          <kbd className="h-5 px-1.5 rounded border border-white/[0.06] bg-white/[0.04] flex items-center gap-0.5">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {/* Center: project switcher */}
      <div className="flex-1 flex justify-center">
        <ProjectSwitcher
          projects={projects}
          activeProjectId={activeProjectId}
        />
      </div>

      {/* Right: bell + user */}
      <div className="flex items-center gap-1.5">
        <NotificationMenu data={notifications} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 inline-flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden lg:inline">
                {userName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl shadow-soft"
          >
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">
                  {userName}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {userEmail}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
