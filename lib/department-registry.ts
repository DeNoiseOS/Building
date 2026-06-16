/**
 * V0.10.1 → V0.11 — Department-first architecture: single source of truth.
 *
 * Each entry defines a canonical department:
 *   key          → stable slug; matches Department.key in the DB
 *   label        → display name
 *   headRoles    → priority-ordered list of roles that can lead this dept.
 *                  The actual head at runtime is whichever role in this
 *                  list is *present* in the project's members (highest
 *                  priority wins). See `resolveHeadRoleFromPresent`.
 *   headRole     → compat alias = headRoles[0] (canonical head). Kept so
 *                  legacy code (Department.kind comparisons) still works.
 *   memberRoles  → non-head roles that can live inside this department
 *   resourceType → what the department's "Resources" tab is called
 *
 * Every permission helper, invitation flow, and resource-label switch
 * reads from this file.
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
  /** Canonical head role = headRoles[0]. Used for legacy Department.kind. */
  headRole: string;
  /**
   * V0.11 — Priority-ordered head candidates. The runtime head is the
   * highest-priority role from this list that is *actually present* in
   * the project's ProjectMember rows.
   */
  headRoles: string[];
  /** Non-head roles inside this department. */
  memberRoles: string[];
  resourceType: ResourceType;
}

const RAW_DEPARTMENTS: Array<Omit<DepartmentEntry, "headRole">> = [
  {
    key: "director",
    label: "Direction",
    headRoles: ["director"],
    memberRoles: [
      "first_assistant_director",
      "second_assistant_director",
      "third_assistant_director",
    ],
    resourceType: "documents",
  },
  {
    key: "production",
    label: "Production",
    // V0.11 — EP outranks Producer.
    headRoles: ["executive_producer", "producer"],
    memberRoles: [
      "line_producer",
      "production_coordinator",
      "production_assistant",
    ],
    resourceType: "documents",
  },
  {
    key: "art",
    label: "Art",
    // V0.11 — PD → AD → Asst AD.
    headRoles: ["production_designer", "art_director", "assistant_art_director"],
    memberRoles: ["prop_master", "set_dresser", "art_assistant"],
    resourceType: "props",
  },
  {
    key: "camera",
    label: "Camera",
    headRoles: ["director_of_photography"],
    memberRoles: ["camera_operator", "first_ac", "second_ac", "dit"],
    resourceType: "equipment",
  },
  {
    key: "sound",
    label: "Sound",
    headRoles: ["sound_mixer"],
    memberRoles: ["boom_operator", "sound_assistant"],
    resourceType: "equipment",
  },
  {
    key: "post",
    label: "Post Production",
    // V0.11 — Post Supervisor → Editor.
    headRoles: ["post_supervisor", "editor"],
    memberRoles: [
      "assistant_editor",
      "colorist",
      "motion_designer",
      "sound_designer",
    ],
    resourceType: "deliverables",
  },
  {
    key: "locations",
    label: "Locations",
    headRoles: ["location_manager"],
    memberRoles: ["location_scout", "location_assistant"],
    resourceType: "location_assets",
  },
  {
    key: "casting",
    label: "Casting",
    headRoles: ["casting_director"],
    memberRoles: ["casting_assistant", "talent_coordinator"],
    resourceType: "talent",
  },
];

export const DEPARTMENTS: DepartmentEntry[] = RAW_DEPARTMENTS.map((d) => ({
  ...d,
  headRole: d.headRoles[0]!,
}));

/**
 * Legacy alias map — V0.2 to V1.0A used role strings as department keys
 * directly (e.g. `camera_department`, `editor`, `casting_manager`). The
 * V0.10.1 registry renames + reshapes these. For backwards compat the
 * old kinds still resolve to a registry entry via this map.
 */
const LEGACY_KIND_TO_KEY: Record<string, string> = {
  director: "director",
  producer: "production",
  executive_producer: "production",
  art_director: "art",
  camera_department: "camera",
  sound_department: "sound",
  editor: "post",
  location_manager: "locations",
  casting_manager: "casting",
  assistant_director: "director",
};

export const ALL_HEAD_ROLES: string[] = Array.from(
  new Set(DEPARTMENTS.flatMap((d) => d.headRoles))
);

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

/** Find the registry entry whose canonical head role matches the kind. */
export function getDepartmentByHeadRole(
  role: string
): DepartmentEntry | null {
  const direct = DEPARTMENTS.find((d) => d.headRoles.includes(role));
  if (direct) return direct;
  const k = LEGACY_KIND_TO_KEY[role];
  return k ? getDepartmentByKey(k) : null;
}

/** Department a given role belongs to (head or member). */
export function getDepartmentForRole(
  role: string
): DepartmentEntry | null {
  const headMatch = DEPARTMENTS.find((d) => d.headRoles.includes(role));
  if (headMatch) return headMatch;
  const memberMatch = DEPARTMENTS.find((d) => d.memberRoles.includes(role));
  if (memberMatch) return memberMatch;
  const k = LEGACY_KIND_TO_KEY[role];
  return k ? getDepartmentByKey(k) : null;
}

/** True if `role` can ever be a head of any registry department. */
export function isRegistryHead(role: string): boolean {
  return DEPARTMENTS.some((d) => d.headRoles.includes(role));
}

/**
 * V0.11 — Resolve the runtime head of a department by checking which of
 * `headRoles` are actually present among the given roles. Returns the
 * highest-priority match, or null if none.
 */
export function resolveHeadRoleFromPresent(
  deptKey: string,
  presentRoles: Iterable<string>
): string | null {
  const dept = getDepartmentByKey(deptKey);
  if (!dept) return null;
  const set = new Set(presentRoles);
  for (const candidate of dept.headRoles) {
    if (set.has(candidate)) return candidate;
  }
  return null;
}

export function resourceTypeForKind(kind: string): ResourceType {
  return getDepartmentByHeadRole(kind)?.resourceType ?? "equipment";
}

export function resourceLabelForKind(kind: string): string {
  return RESOURCE_TYPE_LABELS[resourceTypeForKind(kind)];
}

/**
 * Department invitation rules.
 *
 *   Owner / Executive Producer / Producer → any role
 *   Director                              → any head role
 *   Department Head (resolved)            → only their department's members
 *                                           + lower-priority head candidates
 *   Others                                → none
 */
export function getInvitableRolesForRole(
  role: string | null,
  isOwner: boolean
): string[] {
  if (isOwner) return Array.from(new Set([...ALL_DEPARTMENT_ROLES]));
  if (!role) return [];
  if (role === "executive_producer" || role === "producer") {
    return Array.from(new Set([...ALL_DEPARTMENT_ROLES]));
  }
  if (role === "director") return [...ALL_HEAD_ROLES];

  const dept = getDepartmentForRole(role);
  if (!dept) return [];
  // V0.11 — any role that could be a head of this department can invite
  // members. The runtime "actual head" check happens at the API layer via
  // resolveHeadRoleFromPresent; here we just gate on potential headship.
  if (dept.headRoles.includes(role)) {
    return [...dept.memberRoles];
  }
  return [];
}
