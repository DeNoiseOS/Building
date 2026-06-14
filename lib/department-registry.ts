/**
 * V0.10.1 — Department-first architecture: single source of truth.
 *
 * Each entry defines a canonical department:
 *   key          → stable slug; matches Department.key in the DB
 *   label        → display name
 *   headRole     → the one role string that owns the department (and
 *                  matches Department.kind for routing / authority)
 *   memberRoles  → roles that can live inside this department
 *   resourceType → what the department's "Resources" tab is called
 *
 * Every permission helper, invitation flow, and resource-label switch
 * reads from this file. Adding a new department or moving a role between
 * departments is a one-file change — downstream code re-derives.
 *
 * IMPORTANT: This is intentionally not a Prisma table. Department rows
 * in the DB are spun up per-project from this registry; the registry
 * itself is editorial data shared across all projects.
 */

export type ResourceType =
  | "equipment"
  | "props"
  | "talent"
  | "location_assets"
  | "deliverables"
  | "documents";

export interface DepartmentEntry {
  key: string;
  label: string;
  headRole: string;
  memberRoles: string[];
  resourceType: ResourceType;
}

export const DEPARTMENTS: DepartmentEntry[] = [
  {
    key: "director",
    label: "Director Department",
    headRole: "director",
    memberRoles: [
      "first_assistant_director",
      "second_assistant_director",
      "third_assistant_director",
    ],
    resourceType: "documents",
  },
  {
    key: "production",
    label: "Production Department",
    headRole: "producer",
    memberRoles: [
      "line_producer",
      "production_coordinator",
      "production_assistant",
    ],
    resourceType: "documents",
  },
  {
    key: "art",
    label: "Art Department",
    headRole: "art_director",
    memberRoles: [
      "assistant_art_director",
      "production_designer",
      "prop_master",
      "set_dresser",
      "art_assistant",
    ],
    resourceType: "props",
  },
  {
    key: "camera",
    label: "Camera Department",
    headRole: "director_of_photography",
    memberRoles: ["camera_operator", "first_ac", "second_ac", "dit"],
    resourceType: "equipment",
  },
  {
    key: "sound",
    label: "Sound Department",
    headRole: "sound_mixer",
    memberRoles: ["boom_operator", "sound_assistant"],
    resourceType: "equipment",
  },
  {
    key: "post",
    label: "Post Production",
    headRole: "post_supervisor",
    memberRoles: [
      "editor",
      "assistant_editor",
      "colorist",
      "motion_designer",
      "sound_designer",
    ],
    resourceType: "deliverables",
  },
  {
    key: "locations",
    label: "Locations Department",
    headRole: "location_manager",
    memberRoles: ["location_scout", "location_assistant"],
    resourceType: "location_assets",
  },
  {
    key: "casting",
    label: "Casting Department",
    headRole: "casting_director",
    memberRoles: ["casting_assistant", "talent_coordinator"],
    resourceType: "talent",
  },
];

/**
 * Legacy alias map — V0.2 to V1.0A used role strings as department keys
 * directly (e.g. `camera_department`, `editor`, `casting_manager`). The
 * V0.10.1 registry renames + reshapes these. For backwards compat the
 * old kinds still resolve to a registry entry via this map.
 */
const LEGACY_KIND_TO_KEY: Record<string, string> = {
  director: "director",
  producer: "production",
  art_director: "art",
  camera_department: "camera",
  sound_department: "sound",
  editor: "post",
  location_manager: "locations",
  casting_manager: "casting",
  assistant_director: "director",
};

export const ALL_HEAD_ROLES: string[] = DEPARTMENTS.map((d) => d.headRole);

export const ALL_MEMBER_ROLES: string[] = Array.from(
  new Set(DEPARTMENTS.flatMap((d) => d.memberRoles))
);

export const ALL_DEPARTMENT_ROLES: string[] = Array.from(
  new Set([...ALL_HEAD_ROLES, ...ALL_MEMBER_ROLES])
);

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  equipment: "Equipment",
  props: "Props",
  talent: "Talent",
  location_assets: "Location Assets",
  deliverables: "Deliverables",
  documents: "Documents",
};

/** Find a registry entry by department key (e.g. "art"). */
export function getDepartmentByKey(key: string): DepartmentEntry | null {
  return DEPARTMENTS.find((d) => d.key === key) ?? null;
}

/** Find the registry entry whose head role matches the given kind. */
export function getDepartmentByHeadRole(
  role: string
): DepartmentEntry | null {
  const direct = DEPARTMENTS.find((d) => d.headRole === role);
  if (direct) return direct;
  // Legacy alias: e.g. kind = "camera_department" → "camera"
  const k = LEGACY_KIND_TO_KEY[role];
  return k ? getDepartmentByKey(k) : null;
}

/** Department a given role belongs to (head or member). */
export function getDepartmentForRole(
  role: string
): DepartmentEntry | null {
  const headMatch = DEPARTMENTS.find((d) => d.headRole === role);
  if (headMatch) return headMatch;
  const memberMatch = DEPARTMENTS.find((d) => d.memberRoles.includes(role));
  if (memberMatch) return memberMatch;
  const k = LEGACY_KIND_TO_KEY[role];
  return k ? getDepartmentByKey(k) : null;
}

/** True if `role` is the canonical head of any registry department. */
export function isRegistryHead(role: string): boolean {
  return DEPARTMENTS.some((d) => d.headRole === role);
}

/**
 * Resource label for a department record. Accepts either the new
 * `Department.kind` (head role) or a legacy kind value.
 */
export function resourceTypeForKind(kind: string): ResourceType {
  return getDepartmentByHeadRole(kind)?.resourceType ?? "equipment";
}

export function resourceLabelForKind(kind: string): string {
  return RESOURCE_TYPE_LABELS[resourceTypeForKind(kind)];
}

/**
 * Department invitation rules.
 *
 *   Owner / Producer → any role
 *   Director         → any head role
 *   Department Head  → only their department's member roles
 *   Others           → none
 */
export function getInvitableRolesForRole(
  role: string | null,
  isOwner: boolean
): string[] {
  if (isOwner) return Array.from(new Set([...ALL_DEPARTMENT_ROLES]));
  if (!role) return [];
  if (role === "producer") return Array.from(new Set([...ALL_DEPARTMENT_ROLES]));
  if (role === "director") return [...ALL_HEAD_ROLES];

  const dept = getDepartmentForRole(role);
  if (!dept) return [];
  // Only heads (canonical or legacy) can invite their dept's members.
  if (
    dept.headRole === role ||
    (LEGACY_KIND_TO_KEY[role] && LEGACY_KIND_TO_KEY[role] === dept.key)
  ) {
    return [...dept.memberRoles];
  }
  return [];
}
