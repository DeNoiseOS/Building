/**
 * Role and status vocabularies.
 *
 * V0.2 expands the role list from 3 → 9 to cover the collaboration layer.
 * Single source of truth — adding a new role is a one-file change. Picker
 * components, validation in Zod schemas, sidebar workspace mapping, and the
 * future Department system all read from here.
 */

export const ROLES = [
  // Leadership (V0.2)
  { value: "director", label: "Director" },
  { value: "assistant_director", label: "Assistant Director" },
  { value: "art_director", label: "Art Director" },
  { value: "producer", label: "Producer" },
  // V0.11 — Executive Producer sits between Owner and Producer
  { value: "executive_producer", label: "Executive Producer" },
  { value: "camera_department", label: "Camera Department" },
  { value: "sound_department", label: "Sound Department" },
  { value: "editor", label: "Editor" },
  { value: "location_manager", label: "Location Manager" },
  { value: "casting_manager", label: "Casting Manager" },
  // V0.5 — department-member roles. These are *examples* of the kind of
  // roles that sit under a department head. Adding a new one is a one-line
  // change here + an entry in `lib/hierarchy.ts`.
  { value: "production_designer", label: "Production Designer" },
  { value: "props_master", label: "Props Master" },
  { value: "camera_operator", label: "Camera Operator" },
  { value: "sound_operator", label: "Sound Operator" },
  { value: "assistant_editor", label: "Assistant Editor" },
  { value: "coordinator", label: "Coordinator" },
  // V0.10.1 — full department-first role catalogue. Aligns with the
  // department registry in `lib/department-registry.ts`.
  // Director Department
  { value: "first_assistant_director", label: "1st Assistant Director" },
  { value: "second_assistant_director", label: "2nd Assistant Director" },
  { value: "third_assistant_director", label: "3rd Assistant Director" },
  // Production Department
  { value: "line_producer", label: "Line Producer" },
  { value: "production_coordinator", label: "Production Coordinator" },
  { value: "production_assistant", label: "Production Assistant" },
  // Art Department
  { value: "assistant_art_director", label: "Assistant Art Director" },
  { value: "prop_master", label: "Prop Master" },
  { value: "set_dresser", label: "Set Dresser" },
  { value: "art_assistant", label: "Art Assistant" },
  // Camera Department
  { value: "director_of_photography", label: "Director of Photography" },
  { value: "first_ac", label: "1st AC" },
  { value: "second_ac", label: "2nd AC" },
  { value: "dit", label: "DIT" },
  // Sound Department
  { value: "sound_mixer", label: "Sound Mixer" },
  { value: "boom_operator", label: "Boom Operator" },
  { value: "sound_assistant", label: "Sound Assistant" },
  // Post Production
  { value: "post_supervisor", label: "Post Supervisor" },
  { value: "colorist", label: "Colorist" },
  { value: "motion_designer", label: "Motion Designer" },
  { value: "sound_designer", label: "Sound Designer" },
  // Locations Department
  { value: "location_scout", label: "Location Scout" },
  { value: "location_assistant", label: "Location Assistant" },
  // Casting Department
  { value: "casting_director", label: "Casting Director" },
  { value: "casting_assistant", label: "Casting Assistant" },
  { value: "talent_coordinator", label: "Talent Coordinator" },
] as const;

export type Role = (typeof ROLES)[number]["value"];

export const ROLE_VALUES = ROLES.map((r) => r.value) as readonly Role[];

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label])
);

export function isRole(value: string): value is Role {
  return ROLE_VALUES.includes(value as Role);
}

export const PROJECT_STATUS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[number]["value"];

export const PROJECT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_STATUS.map((s) => [s.value, s.label])
);

export const TASK_STATUS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  // V0.5 — approval workflow foundation
  { value: "waiting_approval", label: "Waiting Approval" },
  { value: "done", label: "Done" },
] as const;

export type TaskStatus = (typeof TASK_STATUS)[number]["value"];

export const TASK_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  TASK_STATUS.map((s) => [s.value, s.label])
);

export const TASK_PRIORITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export type TaskPriority = (typeof TASK_PRIORITY)[number]["value"];

export const TASK_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  TASK_PRIORITY.map((p) => [p.value, p.label])
);

/**
 * Invitation status vocabulary — V0.2.
 */
export const INVITATION_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
] as const;

export type InvitationStatus = (typeof INVITATION_STATUS)[number]["value"];

export const INVITATION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  INVITATION_STATUS.map((s) => [s.value, s.label])
);
