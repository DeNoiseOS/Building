"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutList, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./view-mode";

const VIEWS = [
  { value: "list", label: "List", icon: LayoutList },
  { value: "kanban", label: "Kanban", icon: LayoutGrid },
] as const;

interface ViewToggleProps {
  current: ViewMode;
  paramName?: string;
}

export function ViewToggle({ current, paramName = "view" }: ViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setView(view: ViewMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") params.delete(paramName);
    else params.set(paramName, view);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const active = current === v.value;
        return (
          <button
            key={v.value}
            type="button"
            onClick={() => setView(v.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-all",
              active
                ? "bg-white/[0.06] text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
