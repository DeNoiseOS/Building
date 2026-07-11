import { prisma } from "@/lib/prisma";

/**
 * V0.2 activity vocabulary.
 *
 * Member-related events arrive in V0.2; the rest carry over unchanged from
 * Phase 2 / Phase 3. Messages stored without leading capitalization in V0.2
 * code so the display layer can prefix the actor name cleanly:
 *   "added task 'X'"  →  "Faris added task 'X'"
 *
 * Legacy V0.1 activity used capitalized messages; the V0.2 migration
 * backfilled actorName for those rows, and the display layer (ActivityFeed
 * and `formatActivityLine` in activity-display.ts) lowercases the first
 * letter when an actor is present.
 */
export type ActivityType =
  | "project_created"
  | "project_updated"
  | "project_archived"
  | "project_unarchived"
  | "task_created"
  | "task_completed"
  | "task_updated"
  | "task_deleted"
  | "note_created"
  | "note_updated"
  | "note_deleted"
  | "reference_created"
  | "reference_updated"
  | "reference_deleted"
  | "member_invited"
  | "member_joined"
  | "member_removed"
  | "member_role_changed"
  | "invitation_revoked"
  | "invitation_declined"
  | "department_created"
  | "department_updated"
  | "department_deleted"
  | "department_member_added"
  | "department_member_removed"
  // V0.5 workflow layer
  | "task_assigned"
  | "task_reassigned"
  | "task_waiting_approval"
  | "task_approved"
  | "task_rejected"
  // V0.6 budget requests (kept for backwards-compat with V0.6 rows)
  | "budget_request_created"
  | "budget_request_submitted"
  | "budget_request_approved"
  | "budget_request_rejected"
  | "budget_request_purchased"
  // V0.6.1 — purchase requests (conceptual rename), allocations, comments
  | "purchase_request_created"
  | "purchase_request_approved"
  | "purchase_request_rejected"
  | "purchase_completed"
  // V0.13 — Purchases module
  | "purchase_recorded"
  | "purchase_deleted"
  // V0.14 — Purchase approval workflow
  | "purchase_approved"
  | "purchase_rejected"
  // V0.14 — Custody undo
  | "custody_restored"
  // V0.14.1 — Custody requests
  | "custody_request_submitted"
  | "custody_request_approved"
  | "custody_request_rejected"
  // V0.14.4 — Withdraw flow
  | "custody_request_withdrawn"
  // V0.16 — Asset Management 2.0
  | "equipment_maintenance_logged"
  | "equipment_maintenance_updated"
  | "equipment_maintenance_completed"
  | "damage_report_reviewed"
  // V0.17 — Scene Planning
  | "scene_created"
  | "scene_updated"
  | "scene_deleted"
  | "scene_department_updated"
  | "scene_department_approved"
  // V0.18 — Scene Assets
  | "scene_asset_linked"
  | "scene_asset_updated"
  | "scene_asset_unlinked"
  // V0.20 — Production Bible
  | "bible_entry_added"
  | "bible_entry_updated"
  | "bible_entry_deleted"
  // V0.24 — Agency access
  | "scene_comment_added"
  | "creative_approval_requested"
  | "creative_approval_approved"
  | "creative_approval_rejected"
  // V0.25 — Cast
  | "talent_added"
  | "talent_updated"
  | "talent_removed"
  | "scene_cast_linked"
  | "scene_cast_unlinked"
  // V0.26.1 — Quick-login role personas
  | "member_added"
  | "budget_allocated"
  | "budget_allocation_accepted"
  | "budget_allocation_rejected"
  | "budget_revision_requested"
  | "comment_created"
  | "comment_updated"
  | "comment_deleted"
  // V0.7 communication
  | "announcement_created"
  | "announcement_updated"
  | "announcement_deleted"
  | "discussion_created"
  | "discussion_reply"
  | "mention_created"
  // V0.9 — financial operations
  | "custody_issued"
  | "custody_settlement_requested"
  | "custody_settlement_approved"
  | "custody_cancelled"
  // V0.10 — asset custody
  | "equipment_created"
  | "equipment_updated"
  | "equipment_deleted"
  | "equipment_assigned"
  | "equipment_returned"
  | "damage_report_created"
  | "damage_report_resolved";

interface LogActivityInput {
  projectId: string;
  /** V0.2: every activity has an actor. */
  actorId: string;
  actorName: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a meaningful event against a project. Fire-and-forget — failures
 * log to the server console but don't break the originating mutation.
 */
export async function logActivity({
  projectId,
  actorId,
  actorName,
  type,
  message,
  metadata,
}: LogActivityInput): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        projectId,
        actorId,
        actorName,
        type,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log:", { type, projectId, err });
  }
}

interface ActivityEntry {
  id: string;
  projectId: string;
  type: string;
  message: string;
  metadata: string | null;
  createdAt: Date;
}

export function parseActivityMetadata(
  entry: ActivityEntry
): Record<string, unknown> | null {
  if (!entry.metadata) return null;
  try {
    return JSON.parse(entry.metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}
