/**
 * Pure type + helpers for the task view mode (List | Kanban). Lives in its
 * own file (no "use client" directive) so server components can import the
 * parser without dragging the client toggle component along with it.
 */

export type ViewMode = "list" | "kanban";

export function parseViewMode(value: string | undefined | null): ViewMode {
  return value === "kanban" ? "kanban" : "list";
}
