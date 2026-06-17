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
  /**
   * V0.13 — Categories shown in the Purchase form. `isResource=true`
   * means a Purchase in this category will auto-create an Equipment row
   * in the department's Resources tab.
   */
  purchaseCategories?: PurchaseCategory[];
  /** V0.13 — Categories shown in the Rental form. Same semantics. */
  rentalCategories?: PurchaseCategory[];
}

export interface PurchaseCategory {
  key: string;
  label: string;
  /** Auto-link to Resources (Equipment row) when this category is picked. */
  isResource: boolean;
}

/**
 * V0.13 — Universal "Other" option appended to every dept's category
 * list at API + UI level. When picked, the user types a customCategory
 * name; the optional `saveAsResource` toggle decides whether to also
 * create an Equipment row.
 */
export const OTHER_CATEGORY: PurchaseCategory = {
  key: "other",
  label: "Other",
  isResource: false,
};

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
    purchaseCategories: [
      { key: "stationery", label: "Stationery & Documents", isResource: false },
      { key: "services", label: "Services / Consulting", isResource: false },
      { key: "transportation", label: "Transportation", isResource: false },
      { key: "meals", label: "Meals", isResource: false },
    ],
    rentalCategories: [
      { key: "meeting_room", label: "Meeting Rooms", isResource: false },
    ],
  },
  {
    key: "production",
    label: "Production",
    headRoles: ["executive_producer", "producer"],
    memberRoles: [
      "line_producer",
      "production_coordinator",
      "production_assistant",
    ],
    resourceType: "documents",
    purchaseCategories: [
      { key: "catering", label: "Catering / Meals", isResource: false },
      { key: "permits", label: "Permits & Legal Fees", isResource: false },
      { key: "insurance", label: "Insurance", isResource: false },
      { key: "office_supplies", label: "Office Supplies", isResource: false },
      { key: "services", label: "Services (Accountant, Legal, PAs)", isResource: false },
      { key: "petty_cash", label: "Petty Cash", isResource: false },
      { key: "transportation", label: "Transportation", isResource: false },
    ],
    rentalCategories: [
      { key: "office_space", label: "Production Office", isResource: false },
      { key: "vehicles", label: "Production Vehicles", isResource: true },
      { key: "trailers", label: "Trailers / Honey Wagons", isResource: true },
      { key: "walkies", label: "Walkie-talkies", isResource: true },
    ],
  },
  {
    key: "art",
    label: "Art",
    headRoles: ["production_designer", "art_director", "assistant_art_director"],
    memberRoles: ["prop_master", "set_dresser", "art_assistant"],
    resourceType: "props",
    purchaseCategories: [
      { key: "props", label: "Props", isResource: true },
      { key: "set_dressing", label: "Set Dressing", isResource: true },
      { key: "construction", label: "Construction Materials", isResource: false },
      { key: "wardrobe", label: "Wardrobe / Costumes", isResource: true },
      { key: "makeup_hair", label: "Makeup & Hair Supplies", isResource: false },
      { key: "sfx", label: "Special FX Materials", isResource: false },
      { key: "services", label: "Services (Carpenter, Painter, Tailor)", isResource: false },
      { key: "transportation", label: "Transportation", isResource: false },
    ],
    rentalCategories: [
      { key: "props_heavy", label: "Heavy Props / Furniture", isResource: true },
      { key: "props_light", label: "Light Props", isResource: true },
      { key: "workshop_tools", label: "Workshop Tools", isResource: true },
      { key: "workshop_space", label: "Workshop Space", isResource: false },
      { key: "wardrobe", label: "Wardrobe Rental", isResource: true },
      { key: "art_truck", label: "Art Department Truck", isResource: true },
    ],
  },
  {
    key: "camera",
    label: "Camera",
    headRoles: ["director_of_photography"],
    memberRoles: ["camera_operator", "first_ac", "second_ac", "dit"],
    resourceType: "equipment",
    purchaseCategories: [
      { key: "consumables", label: "Consumables (Batteries, Cables, Cards)", isResource: false },
      { key: "accessories", label: "Filters & Accessories", isResource: true },
      { key: "storage", label: "Hard Drives for DIT", isResource: true },
      { key: "services", label: "Services (DIT, Focus Puller)", isResource: false },
      { key: "transportation", label: "Transportation", isResource: false },
    ],
    rentalCategories: [
      { key: "camera_body", label: "Camera Bodies", isResource: true },
      { key: "lenses", label: "Lenses", isResource: true },
      { key: "lighting", label: "Lighting Kits", isResource: true },
      { key: "equipment_heavy", label: "Heavy Equipment (Crane, Dolly, Jib)", isResource: true },
      { key: "equipment_light", label: "Light Equipment (Sliders, Monitors)", isResource: true },
      { key: "grip", label: "Grip Equipment (C-stands, Sandbags)", isResource: true },
      { key: "generators", label: "Generators", isResource: true },
    ],
  },
  {
    key: "sound",
    label: "Sound",
    headRoles: ["sound_mixer"],
    memberRoles: ["boom_operator", "sound_assistant"],
    resourceType: "equipment",
    purchaseCategories: [
      { key: "consumables", label: "Consumables (Batteries, Windscreens, Cables)", isResource: false },
      { key: "lavaliers", label: "Consumable Lavaliers", isResource: false },
      { key: "services", label: "Services (Sound Editor)", isResource: false },
      { key: "transportation", label: "Transportation", isResource: false },
    ],
    rentalCategories: [
      { key: "microphones", label: "Microphones (Boom, Shotgun)", isResource: true },
      { key: "wireless", label: "Wireless Lavalier Systems", isResource: true },
      { key: "boom_poles", label: "Boom Poles", isResource: true },
      { key: "recorders", label: "Recorders / Mixer Carts", isResource: true },
      { key: "headphones", label: "Headphones", isResource: true },
    ],
  },
  {
    key: "post",
    label: "Post Production",
    headRoles: ["post_supervisor", "editor"],
    memberRoles: [
      "assistant_editor",
      "colorist",
      "motion_designer",
      "sound_designer",
    ],
    resourceType: "deliverables",
    purchaseCategories: [
      { key: "storage", label: "Hard Drives / Archive Storage", isResource: true },
      { key: "software", label: "Software Licenses", isResource: true },
      { key: "cloud_storage", label: "Cloud Storage (Frame.io, Dropbox)", isResource: false },
      { key: "services", label: "Services (VFX, Subtitling, Dubbing, Motion)", isResource: false },
      { key: "music_licensing", label: "Music Licensing", isResource: false },
      { key: "transportation", label: "Transportation (Drive Delivery)", isResource: false },
    ],
    rentalCategories: [
      { key: "edit_suite", label: "Edit Suite", isResource: false },
      { key: "color_suite", label: "Color Grading Suite", isResource: false },
      { key: "mix_studio", label: "Sound Mix Studio", isResource: false },
      { key: "render_farm", label: "Render Farm / Cloud Compute", isResource: false },
      { key: "reference_gear", label: "Reference Monitors / Speakers", isResource: true },
    ],
  },
  {
    key: "locations",
    label: "Locations",
    headRoles: ["location_manager"],
    memberRoles: ["location_scout", "location_assistant"],
    resourceType: "location_assets",
    purchaseCategories: [
      { key: "permits", label: "Permits & Licenses", isResource: false },
      { key: "insurance", label: "Location Insurance", isResource: false },
      { key: "cleaning", label: "Cleaning Supplies", isResource: false },
      { key: "services", label: "Services (Security, Fixer, Cleaner)", isResource: false },
      { key: "transportation", label: "Transportation Between Locations", isResource: false },
    ],
    rentalCategories: [
      { key: "location_fee", label: "Location Fee", isResource: true },
      { key: "generators", label: "Generators", isResource: true },
      { key: "climate", label: "AC / Heat Units", isResource: true },
      { key: "tents", label: "Tents / Pavilions", isResource: true },
      { key: "honey_wagons", label: "Mobile Restrooms / Honey Wagons", isResource: true },
      { key: "parking", label: "Parking Spaces", isResource: false },
    ],
  },
  {
    key: "casting",
    label: "Casting",
    headRoles: ["casting_director"],
    memberRoles: ["casting_assistant", "talent_coordinator"],
    resourceType: "talent",
    purchaseCategories: [
      { key: "talent_fees", label: "Talent Fees", isResource: false },
      { key: "headshots", label: "Headshots / Audition Tapes", isResource: true },
      { key: "services", label: "Services (Coach, Stand-ins, Extras Casting)", isResource: false },
      { key: "accommodation", label: "Talent Accommodation", isResource: false },
      { key: "per_diem", label: "Per Diem", isResource: false },
      { key: "transportation", label: "Talent Transportation", isResource: false },
      { key: "meals", label: "Talent Meals", isResource: false },
    ],
    rentalCategories: [
      { key: "audition_room", label: "Audition / Casting Room", isResource: false },
    ],
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
 * V0.13 — Get the purchase or rental categories for a given department,
 * always appending the universal "Other" option last.
 */
export function getCategoriesFor(
  deptKey: string,
  type: "purchase" | "rental"
): PurchaseCategory[] {
  const dept = getDepartmentByKey(deptKey);
  if (!dept) return [OTHER_CATEGORY];
  const base =
    type === "purchase"
      ? dept.purchaseCategories ?? []
      : dept.rentalCategories ?? [];
  return [...base, OTHER_CATEGORY];
}

/** Find a category by (deptKey, type, categoryKey). */
export function findCategory(
  deptKey: string,
  type: "purchase" | "rental",
  categoryKey: string
): PurchaseCategory | null {
  return (
    getCategoriesFor(deptKey, type).find((c) => c.key === categoryKey) ?? null
  );
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
