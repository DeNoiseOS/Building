/**
 * V0.5 — Organizational hierarchy registry.
 *
 * The single source of truth for the hierarchy / invitation / approval system.
 * Every role declares:
 *
 *   - level         numeric rank (higher = more authority)
 *   - parentRoles   roles immediately above (used for hint UI / breadcrumbs)
 *   - canInvite     roles this role is allowed to invite into a project
 *   - departmentKind  the Department.kind this role lives under (V1.0A)
 *
 * No permission helper, API, or component should hardcode role names outside
 * this file. Add a new role here + lib/roles.ts only — every downstream
 * check reads from this registry.
 */

import type { Role } from "@/lib/roles";

export type HierarchyLevel =
  | "producer"
  | "director"
  | "department_head"
  | "department_member"
  // V0.24 — Agency/client tier. Sits outside the production
  // hierarchy; permission handled by `isClientRole` in lib/roles.
  | "agency";

export interface RoleDef {
  /** Numeric rank — comparable across roles. */
  level: number;
  /** Logical tier — used by permission helpers and dashboards. */
  tier: HierarchyLevel;
  /** Roles directly above this one in the org chart. */
  parentRoles: Role[];
  /** Roles this role is allowed to invite. */
  canInvite: Role[];
  /**
   * Department kind this role belongs to. Heads share their role value
   * (`art_director` → `art_director` department), members map to their
   * head's kind (`props_master` → `art_director` department).
   */
  departmentKind: Role | null;
  /**
   * If true, this role represents a department-head position within its
   * `departmentKind`. Used by the approval workflow and visibility rules.
   */
  isHead: boolean;
}

/** Hierarchy registry. */
export const HIERARCHY: Record<Role, RoleDef> = {
  // ─── Executive tier (V0.11) ────────────────────────────────────────────
  // Sits between Owner and Producer. Project-wide visibility, can invite
  // Producers + department heads, cannot delete the project or transfer
  // ownership (enforced in lib/permissions.ts).
  executive_producer: {
    level: 110,
    tier: "producer",
    parentRoles: [],
    canInvite: [
      "producer",
      "director",
      "assistant_director",
      "art_director",
      "camera_department",
      "sound_department",
      "editor",
      "location_manager",
      "casting_manager",
      "director_of_photography",
      "sound_mixer",
      "post_supervisor",
      "casting_director",
    ],
    departmentKind: null,
    isHead: false,
  },
  // ─── Top tier ──────────────────────────────────────────────────────────
  producer: {
    level: 100,
    tier: "producer",
    parentRoles: ["executive_producer"],
    canInvite: [
      "director",
      "assistant_director",
      "art_director",
      "producer",
      "camera_department",
      "sound_department",
      "editor",
      "location_manager",
      "casting_manager",
      "production_designer",
      "props_master",
      "camera_operator",
      "sound_operator",
      "assistant_editor",
      "coordinator",
    ],
    departmentKind: null,
    isHead: false,
  },
  director: {
    level: 90,
    tier: "director",
    parentRoles: ["producer"],
    canInvite: [
      "assistant_director",
      "art_director",
      "camera_department",
      "sound_department",
      "editor",
      "location_manager",
      "casting_manager",
    ],
    departmentKind: "director",
    isHead: true,
  },

  // ─── Department heads ──────────────────────────────────────────────────
  assistant_director: {
    level: 70,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["coordinator"],
    departmentKind: "assistant_director",
    isHead: true,
  },
  art_director: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["production_designer", "props_master"],
    departmentKind: "art_director",
    isHead: true,
  },
  camera_department: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["camera_operator"],
    departmentKind: "camera_department",
    isHead: true,
  },
  sound_department: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["sound_operator"],
    departmentKind: "sound_department",
    isHead: true,
  },
  editor: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["assistant_editor"],
    departmentKind: "editor",
    isHead: true,
  },
  location_manager: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["coordinator"],
    departmentKind: "location_manager",
    isHead: true,
  },
  casting_manager: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: ["coordinator"],
    departmentKind: "casting_manager",
    isHead: true,
  },

  // ─── Department members ────────────────────────────────────────────────
  production_designer: {
    level: 20,
    tier: "department_member",
    parentRoles: ["art_director"],
    canInvite: [],
    departmentKind: "art_director",
    isHead: false,
  },
  props_master: {
    level: 15,
    tier: "department_member",
    parentRoles: ["art_director"],
    canInvite: [],
    departmentKind: "art_director",
    isHead: false,
  },
  camera_operator: {
    level: 15,
    tier: "department_member",
    parentRoles: ["camera_department"],
    canInvite: [],
    departmentKind: "camera_department",
    isHead: false,
  },
  sound_operator: {
    level: 15,
    tier: "department_member",
    parentRoles: ["sound_department"],
    canInvite: [],
    departmentKind: "sound_department",
    isHead: false,
  },
  assistant_editor: {
    level: 15,
    tier: "department_member",
    parentRoles: ["editor"],
    canInvite: [],
    departmentKind: "editor",
    isHead: false,
  },
  coordinator: {
    level: 10,
    tier: "department_member",
    parentRoles: ["assistant_director"],
    canInvite: [],
    departmentKind: null,
    isHead: false,
  },

  // ─── V0.10.1 — department-first role catalogue ──────────────────────
  // Director Department members
  first_assistant_director: {
    level: 30,
    tier: "department_member",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "director",
    isHead: false,
  },
  second_assistant_director: {
    level: 25,
    tier: "department_member",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "director",
    isHead: false,
  },
  third_assistant_director: {
    level: 20,
    tier: "department_member",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "director",
    isHead: false,
  },
  // Production Department members
  line_producer: {
    level: 40,
    tier: "department_member",
    parentRoles: ["producer"],
    canInvite: [],
    departmentKind: "producer",
    isHead: false,
  },
  production_coordinator: {
    level: 20,
    tier: "department_member",
    parentRoles: ["producer"],
    canInvite: [],
    departmentKind: "producer",
    isHead: false,
  },
  production_assistant: {
    level: 10,
    tier: "department_member",
    parentRoles: ["producer"],
    canInvite: [],
    departmentKind: "producer",
    isHead: false,
  },
  // Art Department members
  assistant_art_director: {
    level: 30,
    tier: "department_member",
    parentRoles: ["art_director"],
    canInvite: [],
    departmentKind: "art_director",
    isHead: false,
  },
  prop_master: {
    level: 20,
    tier: "department_member",
    parentRoles: ["art_director"],
    canInvite: [],
    departmentKind: "art_director",
    isHead: false,
  },
  set_dresser: {
    level: 15,
    tier: "department_member",
    parentRoles: ["art_director"],
    canInvite: [],
    departmentKind: "art_director",
    isHead: false,
  },
  art_assistant: {
    level: 10,
    tier: "department_member",
    parentRoles: ["art_director"],
    canInvite: [],
    departmentKind: "art_director",
    isHead: false,
  },
  // Camera Department head + members
  director_of_photography: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "director_of_photography",
    isHead: true,
  },
  first_ac: {
    level: 25,
    tier: "department_member",
    parentRoles: ["director_of_photography"],
    canInvite: [],
    departmentKind: "director_of_photography",
    isHead: false,
  },
  second_ac: {
    level: 20,
    tier: "department_member",
    parentRoles: ["director_of_photography"],
    canInvite: [],
    departmentKind: "director_of_photography",
    isHead: false,
  },
  dit: {
    level: 20,
    tier: "department_member",
    parentRoles: ["director_of_photography"],
    canInvite: [],
    departmentKind: "director_of_photography",
    isHead: false,
  },
  // Sound Department head + members
  sound_mixer: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "sound_mixer",
    isHead: true,
  },
  boom_operator: {
    level: 20,
    tier: "department_member",
    parentRoles: ["sound_mixer"],
    canInvite: [],
    departmentKind: "sound_mixer",
    isHead: false,
  },
  sound_assistant: {
    level: 15,
    tier: "department_member",
    parentRoles: ["sound_mixer"],
    canInvite: [],
    departmentKind: "sound_mixer",
    isHead: false,
  },
  // Post Production head + members
  post_supervisor: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "post_supervisor",
    isHead: true,
  },
  colorist: {
    level: 25,
    tier: "department_member",
    parentRoles: ["post_supervisor"],
    canInvite: [],
    departmentKind: "post_supervisor",
    isHead: false,
  },
  motion_designer: {
    level: 20,
    tier: "department_member",
    parentRoles: ["post_supervisor"],
    canInvite: [],
    departmentKind: "post_supervisor",
    isHead: false,
  },
  sound_designer: {
    level: 20,
    tier: "department_member",
    parentRoles: ["post_supervisor"],
    canInvite: [],
    departmentKind: "post_supervisor",
    isHead: false,
  },
  // Locations members (head is location_manager — defined above)
  location_scout: {
    level: 20,
    tier: "department_member",
    parentRoles: ["location_manager"],
    canInvite: [],
    departmentKind: "location_manager",
    isHead: false,
  },
  location_assistant: {
    level: 15,
    tier: "department_member",
    parentRoles: ["location_manager"],
    canInvite: [],
    departmentKind: "location_manager",
    isHead: false,
  },
  // Casting head + members
  casting_director: {
    level: 50,
    tier: "department_head",
    parentRoles: ["director"],
    canInvite: [],
    departmentKind: "casting_director",
    isHead: true,
  },
  casting_assistant: {
    level: 15,
    tier: "department_member",
    parentRoles: ["casting_director"],
    canInvite: [],
    departmentKind: "casting_director",
    isHead: false,
  },
  talent_coordinator: {
    level: 20,
    tier: "department_member",
    parentRoles: ["casting_director"],
    canInvite: [],
    departmentKind: "casting_director",
    isHead: false,
  },
  // V0.24 — Agency / client roles. Live outside the production
  // hierarchy: they don't belong to any department, they can't
  // invite anyone, and their level is only used for display sort.
  // Permissions are gated by the `isClientRole` check, not levels.
  agency_creative_director: {
    level: 10,
    tier: "agency",
    parentRoles: [],
    canInvite: [],
    departmentKind: null,
    isHead: false,
  },
  agency_copywriter: {
    level: 10,
    tier: "agency",
    parentRoles: [],
    canInvite: [],
    departmentKind: null,
    isHead: false,
  },
  agency_brand_manager: {
    level: 10,
    tier: "agency",
    parentRoles: [],
    canInvite: [],
    departmentKind: null,
    isHead: false,
  },
  agency_account_manager: {
    level: 10,
    tier: "agency",
    parentRoles: [],
    canInvite: [],
    departmentKind: null,
    isHead: false,
  },
};

export function roleDef(role: string): RoleDef | null {
  return (HIERARCHY as Record<string, RoleDef>)[role] ?? null;
}

export function roleLevel(role: string): number {
  return roleDef(role)?.level ?? 0;
}

export function roleTier(role: string): HierarchyLevel | null {
  return roleDef(role)?.tier ?? null;
}

export function isHead(role: string): boolean {
  return roleDef(role)?.isHead ?? false;
}

export function departmentKindForRole(role: string): string | null {
  return roleDef(role)?.departmentKind ?? null;
}

export function rolesInvitableBy(role: string): string[] {
  return roleDef(role)?.canInvite ?? [];
}

export function canInviteRole(callerRole: string, targetRole: string): boolean {
  return rolesInvitableBy(callerRole).includes(targetRole);
}

/** Producers + Directors have global visibility on their projects. */
export function isProjectWideRole(role: string): boolean {
  const def = roleDef(role);
  return def?.tier === "producer" || def?.tier === "director";
}
