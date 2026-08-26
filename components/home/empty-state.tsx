import Link from "next/link";
import { Panel } from "./section-header";

/**
 * V0.27.1 — Home empty state (only when every section is empty).
 * Compact — no giant empty rectangle.
 */
export function HomeEmptyState() {
  return (
    <Panel className="px-6 py-8 text-center">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--denoise-copper)]">
        Standby
      </p>
      <h3 className="mt-2 text-base font-medium text-[var(--denoise-cream)]">
        Command deck is clear.
      </h3>
      <p className="mt-1 text-[12px] text-[var(--denoise-cream-muted)]">
        Nothing needs your attention right now. Open{" "}
        <Link
          href="/dashboard"
          className="text-[var(--denoise-copper)] hover:underline underline-offset-2"
        >
          Dashboard
        </Link>{" "}
        for the cross-project analytics.
      </p>
    </Panel>
  );
}
