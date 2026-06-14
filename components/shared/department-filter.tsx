"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  parseDeptFilter,
  serializeDeptFilter,
  type DeptFilter,
} from "@/lib/department-filter";

export interface DepartmentOption {
  id: string;
  name: string;
}

interface Props {
  departments: DepartmentOption[];
  /** Whether the caller is in any of the listed departments. */
  hasOwnDepartments: boolean;
  /** Optional query-param key, defaults to `dept`. */
  paramKey?: string;
  /** Label override. */
  label?: string;
  className?: string;
}

export function DepartmentFilter({
  departments,
  hasOwnDepartments,
  paramKey = "dept",
  label = "Department",
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const current: DeptFilter = useMemo(
    () => parseDeptFilter(search.get(paramKey)),
    [search, paramKey]
  );

  const summary = useMemo(() => {
    if (current.mode === "all") return "All departments";
    if (current.mode === "mine") return "My department";
    if (current.departmentIds.length === 0) return "All departments";
    if (current.departmentIds.length === 1) {
      const d = departments.find((x) => x.id === current.departmentIds[0]);
      return d?.name ?? "1 department";
    }
    return `${current.departmentIds.length} departments`;
  }, [current, departments]);

  function setFilter(next: DeptFilter) {
    const params = new URLSearchParams(search.toString());
    const v = serializeDeptFilter(next);
    if (v === null) params.delete(paramKey);
    else params.set(paramKey, v);
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  }

  function togglePresetAll() {
    setFilter({ mode: "all", departmentIds: [] });
  }

  function togglePresetMine() {
    setFilter({ mode: "mine", departmentIds: [] });
  }

  function toggleDept(id: string) {
    const next = new Set(
      current.mode === "custom" ? current.departmentIds : []
    );
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) {
      setFilter({ mode: "all", departmentIds: [] });
    } else {
      setFilter({ mode: "custom", departmentIds: Array.from(next) });
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", className)}
          aria-label={`${label}: ${summary}`}
        >
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{summary}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <Row
          label="All departments"
          active={current.mode === "all"}
          onClick={togglePresetAll}
        />
        {hasOwnDepartments && (
          <Row
            label="My department"
            active={current.mode === "mine"}
            onClick={togglePresetMine}
          />
        )}
        <div className="my-1 h-px bg-white/[0.06]" />
        <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">
          Specific departments
        </div>
        {departments.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No departments on this project yet.
          </div>
        ) : (
          departments.map((d) => (
            <Row
              key={d.id}
              label={d.name}
              active={
                current.mode === "custom" &&
                current.departmentIds.includes(d.id)
              }
              onClick={() => toggleDept(d.id)}
            />
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-left transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-white/[0.04]"
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-sm border flex items-center justify-center shrink-0",
          active
            ? "bg-primary border-primary text-white"
            : "border-white/[0.08]"
        )}
      >
        {active && <Check className="h-3 w-3" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
