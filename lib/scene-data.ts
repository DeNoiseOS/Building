/**
 * V0.17 — Scene vocabulary.
 *
 * Pure constants — safe to import from client components. The
 * server-only helper (recomputeSceneReadiness) lives in
 * `lib/scene-server.ts`.
 */

export const SCENE_TYPES = [
  { value: "INT", label: "Interior" },
  { value: "EXT", label: "Exterior" },
  { value: "INT_EXT", label: "Interior / Exterior" },
] as const;
export const SCENE_TYPE_VALUES = SCENE_TYPES.map((s) => s.value);

export const SCENE_TIME_OF_DAY = [
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
  { value: "dawn", label: "Dawn" },
  { value: "dusk", label: "Dusk" },
] as const;
export const SCENE_TIME_VALUES = SCENE_TIME_OF_DAY.map((t) => t.value);

export const SCENE_STATUS = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "ready", label: "Ready" },
  { value: "scheduled", label: "Scheduled" },
  { value: "shot", label: "Shot" },
  { value: "completed", label: "Completed" },
] as const;
export const SCENE_STATUS_VALUES = SCENE_STATUS.map((s) => s.value);
export const SCENE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  SCENE_STATUS.map((s) => [s.value, s.label])
);

export const SCENE_DEPT_STATUS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
] as const;
export const SCENE_DEPT_STATUS_VALUES = SCENE_DEPT_STATUS.map((s) => s.value);

export const SCENE_DEPT_APPROVAL = [
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
] as const;
