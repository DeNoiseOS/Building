import { format } from "date-fns";

/**
 * Formats a date relative to "now" with a tone token usable by Badge variants.
 * Phase 3 introduces several new surfaces that need this; centralising here
 * keeps the Tasks UI consistent.
 *
 * (Dashboard and Project Overview have their own copies from Phase 2 — they
 * stay as-is per the cleanup-deferred decision.)
 */
export function relativeDue(date: Date, now: Date = new Date()): {
  label: string;
  tone: "default" | "destructive" | "secondary";
} {
  const ms = date.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0)
    return { label: `${Math.abs(days)}d overdue`, tone: "destructive" };
  if (days === 0) return { label: "Today", tone: "default" };
  if (days === 1) return { label: "Tomorrow", tone: "default" };
  if (days <= 7) return { label: `In ${days}d`, tone: "default" };
  return { label: format(date, "MMM d"), tone: "secondary" };
}
