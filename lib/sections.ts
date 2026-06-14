import {
  StickyNote,
  Image as ImageIcon,
  Lightbulb,
  FileText,
  Users,
  ListChecks,
  CalendarClock,
  Palette,
  Package,
  ClipboardCheck,
  Camera,
  Mic,
  Scissors,
  MapPin,
  UserCheck,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

/**
 * ## Sections — V0.1 presentation-layer concept
 *
 * A "section" is just a string tag stored on Notes, References, and Tasks
 * (`section` column on each). It is **not** a separate entity. The map below
 * defines which sections compose each role's Workspace tab today.
 *
 * Future versions will introduce real Departments and multiple workspaces per
 * project. When that happens the data already shipped — section strings on
 * existing rows — becomes the input to that migration without any rework. The
 * Workspace tab is a presentation surface over the existing data model; it
 * intentionally does not bake "one workspace per project" into the schema.
 */

export type SectionType = "notes" | "references" | "tasks";

export interface SectionDef {
  /** Stable identifier persisted as `section` on rows. */
  key: string;
  label: string;
  type: SectionType;
  icon: LucideIcon;
  description?: string;
}

const DIRECTOR_SECTIONS: SectionDef[] = [
  {
    key: "director_notes",
    label: "Director Notes",
    type: "notes",
    icon: StickyNote,
    description: "Beats, intentions, and creative direction.",
  },
  {
    key: "creative_notes",
    label: "Creative Notes",
    type: "notes",
    icon: Lightbulb,
    description: "Ideas and discoveries in development.",
  },
  {
    key: "director_references",
    label: "References",
    type: "references",
    icon: ImageIcon,
    description: "Visual and tonal references.",
  },
  {
    key: "director_tasks",
    label: "Director Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Your personal to-dos on this production.",
  },
];

const AD_SECTIONS: SectionDef[] = [
  {
    key: "schedule",
    label: "Schedule",
    type: "notes",
    icon: CalendarClock,
    description: "Shoot days, prep days, key dates.",
  },
  {
    key: "crew_notes",
    label: "Crew Notes",
    type: "notes",
    icon: Users,
    description: "Crew assignments and availability.",
  },
  {
    key: "followups",
    label: "Follow-Ups",
    type: "tasks",
    icon: ClipboardCheck,
    description: "Items waiting on someone else.",
  },
  {
    key: "production_tasks",
    label: "Production Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Production-side to-dos.",
  },
];

const ART_DIRECTOR_SECTIONS: SectionDef[] = [
  {
    key: "moodboards",
    label: "Moodboards",
    type: "notes",
    icon: Palette,
    description: "Tone, palette, and visual concept notes.",
  },
  {
    key: "art_references",
    label: "Art References",
    type: "references",
    icon: ImageIcon,
    description: "Look references for the art department.",
  },
  {
    key: "props",
    label: "Props",
    type: "notes",
    icon: Package,
    description: "Prop concepts, sourcing notes, hero items.",
  },
  {
    key: "art_tasks",
    label: "Department Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Art department to-dos.",
  },
];

const PRODUCER_SECTIONS: SectionDef[] = [
  {
    key: "budget_notes",
    label: "Budget Notes",
    type: "notes",
    icon: DollarSign,
    description: "Budget lines, vendor quotes, and cost decisions.",
  },
  {
    key: "vendor_notes",
    label: "Vendors & Crew",
    type: "notes",
    icon: Users,
    description: "Vendor contacts, contracts, and crew bookings.",
  },
  {
    key: "producer_tasks",
    label: "Production Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Producer-side to-dos.",
  },
];

const CAMERA_SECTIONS: SectionDef[] = [
  {
    key: "camera_notes",
    label: "Camera Notes",
    type: "notes",
    icon: Camera,
    description: "Lensing, framing, and camera plan.",
  },
  {
    key: "camera_references",
    label: "Camera References",
    type: "references",
    icon: ImageIcon,
    description: "Look references for the camera department.",
  },
  {
    key: "camera_tasks",
    label: "Department Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Camera department to-dos.",
  },
];

const SOUND_SECTIONS: SectionDef[] = [
  {
    key: "sound_notes",
    label: "Sound Notes",
    type: "notes",
    icon: Mic,
    description: "Location sound plan, mic placement, sync notes.",
  },
  {
    key: "sound_references",
    label: "Sound References",
    type: "references",
    icon: ImageIcon,
    description: "Tonal and sonic references.",
  },
  {
    key: "sound_tasks",
    label: "Department Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Sound department to-dos.",
  },
];

const EDITOR_SECTIONS: SectionDef[] = [
  {
    key: "edit_notes",
    label: "Edit Notes",
    type: "notes",
    icon: Scissors,
    description: "Cut decisions, structure, and pacing notes.",
  },
  {
    key: "edit_references",
    label: "Edit References",
    type: "references",
    icon: ImageIcon,
    description: "Reference cuts and pacing inspiration.",
  },
  {
    key: "edit_tasks",
    label: "Edit Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Post-side to-dos.",
  },
];

const LOCATION_SECTIONS: SectionDef[] = [
  {
    key: "location_notes",
    label: "Location Notes",
    type: "notes",
    icon: MapPin,
    description: "Scout notes, permits, contacts, and access.",
  },
  {
    key: "location_references",
    label: "Scout Photos",
    type: "references",
    icon: ImageIcon,
    description: "Photos and references from scouts.",
  },
  {
    key: "location_tasks",
    label: "Location Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Location department to-dos.",
  },
];

const CASTING_SECTIONS: SectionDef[] = [
  {
    key: "casting_notes",
    label: "Casting Notes",
    type: "notes",
    icon: UserCheck,
    description: "Candidate notes, callbacks, and decisions.",
  },
  {
    key: "casting_references",
    label: "Candidate References",
    type: "references",
    icon: ImageIcon,
    description: "Headshots, reels, and look references.",
  },
  {
    key: "casting_tasks",
    label: "Casting Tasks",
    type: "tasks",
    icon: ListChecks,
    description: "Casting department to-dos.",
  },
];

const SECTIONS_BY_ROLE: Partial<Record<Role, SectionDef[]>> = {
  director: DIRECTOR_SECTIONS,
  assistant_director: AD_SECTIONS,
  art_director: ART_DIRECTOR_SECTIONS,
  producer: PRODUCER_SECTIONS,
  camera_department: CAMERA_SECTIONS,
  sound_department: SOUND_SECTIONS,
  editor: EDITOR_SECTIONS,
  location_manager: LOCATION_SECTIONS,
  casting_manager: CASTING_SECTIONS,
  // V0.5 — department-member roles inherit their head's section
  // composition so members see the same workspace columns by default.
  production_designer: ART_DIRECTOR_SECTIONS,
  props_master: ART_DIRECTOR_SECTIONS,
  camera_operator: CAMERA_SECTIONS,
  sound_operator: SOUND_SECTIONS,
  assistant_editor: EDITOR_SECTIONS,
  coordinator: AD_SECTIONS,
};

/**
 * Returns the section composition for a project role, or an empty array if
 * the role isn't mapped (defensive — keeps the UI from crashing for any role
 * value that ends up in the DB outside the V0.1 vocabulary).
 */
export function getSectionsForRole(role: string): SectionDef[] {
  return SECTIONS_BY_ROLE[role as Role] ?? [];
}

export function findSectionByKey(
  role: string,
  key: string
): SectionDef | undefined {
  return getSectionsForRole(role).find((s) => s.key === key);
}

/** Distinct section keys defined across all roles. Used for validation. */
export const ALL_SECTION_KEYS = new Set<string>(
  Object.values(SECTIONS_BY_ROLE)
    .flat()
    .filter((s): s is SectionDef => !!s)
    .map((s) => s.key)
);

/**
 * Fallback for displaying a section badge when the section is set on a row
 * but doesn't exist in the role's current composition (e.g. user changed
 * project role after creating tagged items).
 */
export function humanizeSectionKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Re-export Icon type for consumers.
export type { LucideIcon };
// File-icon export so empty-section can fall back to a generic icon.
export const DEFAULT_SECTION_ICON: LucideIcon = FileText;
