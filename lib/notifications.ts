import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.5 — In-app notifications.
 *
 * Notifications are unicast (one row per recipient) and in-app only.
 * Each call to `notify(...)` lands as one `Notification` row; the bell
 * dropdown groups them by `type` for display.
 */

export type NotificationType =
  | "invitation_received"
  | "invitation_accepted"
  | "task_assigned"
  | "task_reassigned"
  | "task_waiting_approval"
  | "task_approved"
  | "task_rejected"
  | "department_member_added"
  // V0.6 budget requests (still emitted for legacy code paths)
  | "budget_request_submitted"
  | "budget_request_approved"
  | "budget_request_rejected"
  | "budget_request_purchased"
  // V0.6.1
  | "purchase_request_submitted"
  | "purchase_request_approved"
  | "purchase_request_rejected"
  | "purchase_completed"
  // V0.13 / V0.14 — direct Purchase model
  | "purchase_recorded"
  | "purchase_approved"
  | "purchase_rejected"
  // V0.14.1 — Custody requests
  | "custody_request_submitted"
  | "custody_request_approved"
  | "custody_request_rejected"
  | "budget_allocated"
  | "budget_allocation_accepted"
  | "budget_allocation_rejected"
  | "budget_revision_requested"
  | "budget_revision_resolved"
  | "comment_created"
  // V0.7 — communication layer
  | "mention_task"
  | "mention_budget"
  | "mention_note"
  | "mention_reference"
  | "mention_announcement"
  | "mention_discussion"
  | "announcement_created"
  | "discussion_created"
  | "discussion_reply"
  // V0.9 — financial operations
  | "custody_issued"
  | "custody_settlement_requested"
  | "custody_settlement_approved"
  // V0.10 — asset custody
  | "equipment_assigned"
  | "equipment_returned"
  | "damage_report_created"
  | "damage_report_resolved";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    // Notification delivery is best-effort. Never let it block the main
    // mutation flow.
    console.error("[notify] failed", err);
  }
}

/** Bulk notify — same payload to many users (dedup, skip self). */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId"> & { skipUserId?: string }
): Promise<void> {
  const { skipUserId, ...payload } = input;
  const targets = Array.from(new Set(userIds)).filter(
    (id) => id !== skipUserId
  );
  if (targets.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        link: payload.link ?? null,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      })),
    });
  } catch (err) {
    console.error("[notifyMany] failed", err);
  }
}
