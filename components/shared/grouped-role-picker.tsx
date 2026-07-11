"use client";

/**
 * V0.11 — Department-grouped role picker.
 *
 * Replaces the long flat role <Select>. Roles are organized by the
 * department they belong to (from `lib/department-registry.ts`).
 *
 * Behavior:
 *   - Accepts an optional `availableRoles` allow-list (used to restrict
 *     the picker to roles the caller is permitted to invite). When
 *     omitted, every registry role is available.
 *   - Renders department cards with grouped role choices. The currently
 *     selected role is highlighted across the whole picker.
 *   - On click, calls `onChange(roleValue)`.
 */

import { useMemo } from "react";
import { DEPARTMENTS } from "@/lib/department-registry";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface GroupedRolePickerProps {
  value: string;
  onChange: (role: string) => void;
  /** Optional allow-list. If provided, only these roles render. */
  availableRoles?: string[];
}

export function GroupedRolePicker({
  value,
  onChange,
  availableRoles,
}: GroupedRolePickerProps) {
  const allowSet = useMemo(
    () => (availableRoles ? new Set(availableRoles) : null),
    [availableRoles]
  );

  // V0.25.1 — Agency (client-side) roles aren't part of any department.
  // Give them their own section so they render in the picker.
  const AGENCY_ROLES = [
    "agency_creative_director",
    "agency_copywriter",
    "agency_brand_manager",
    "agency_account_manager",
  ];

  const sections = useMemo(() => {
    const deptSections = DEPARTMENTS.map((dept) => {
      const allRoles = [...dept.headRoles, ...dept.memberRoles];
      const visible = allowSet
        ? allRoles.filter((r) => allowSet.has(r))
        : allRoles;
      return {
        key: dept.key,
        label: dept.label,
        roles: visible,
      };
    }).filter((s) => s.roles.length > 0);

    const agencyVisible = allowSet
      ? AGENCY_ROLES.filter((r) => allowSet.has(r))
      : AGENCY_ROLES;
    if (agencyVisible.length > 0) {
      deptSections.push({
        key: "agency",
        label: "Agency (Client)",
        roles: agencyVisible,
      });
    }
    return deptSections;
  }, [allowSet]);

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3">
        No roles available to assign.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sections.map(({ key, label, roles }) => (
        <div
          key={key}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div className="flex flex-col gap-1">
            {roles.map((r) => {
              const selected = r === value;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange(r)}
                  className={cn(
                    "text-left text-sm rounded-md px-2 py-1.5 transition",
                    "border border-transparent",
                    selected
                      ? "bg-primary/15 text-primary-foreground border-primary/40"
                      : "hover:bg-white/[0.04] text-foreground/90"
                  )}
                >
                  {ROLE_LABELS[r] ?? r}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
