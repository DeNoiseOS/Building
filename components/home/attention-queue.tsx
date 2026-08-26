import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, SectionHeader } from "./section-header";
import type { ReactNode } from "react";

export interface AttentionItem {
  key: string;
  icon: ReactNode;
  label: string;
  href: string;
  tone: "primary" | "amber" | "red";
  meta?: string;
}

/**
 * V0.27.1 — Attention Queue as a narrow operational column.
 * Compact stacked rows with an icon chip + label + right-side meta.
 * Empty state is a small in-panel line, never a large dead rectangle.
 */
export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <Panel>
      <SectionHeader
        title="Attention Queue"
        count={items.length}
        href="/inbox"
      />
      {items.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[var(--denoise-cream-muted)]">
          Nothing needs a decision right now.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--denoise-border)]">
          {items.slice(0, 6).map((a) => (
            <li key={a.key}>
              <Link
                href={a.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--denoise-surface-2)] transition-colors group"
              >
                <span
                  className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center shrink-0 border",
                    a.tone === "red" &&
                      "bg-red-500/[0.08] text-red-300 border-red-500/25",
                    a.tone === "amber" &&
                      "bg-amber-500/[0.08] text-amber-300 border-amber-500/25",
                    a.tone === "primary" &&
                      "bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)] border-[var(--denoise-copper-border)]"
                  )}
                >
                  {a.icon}
                </span>
                <p className="text-[13px] text-[var(--denoise-cream)] flex-1 leading-snug truncate">
                  {a.label}
                </p>
                {a.meta && (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] shrink-0">
                    {a.meta}
                  </span>
                )}
                <ArrowUpRight className="h-3 w-3 text-[var(--denoise-cream-muted)] group-hover:text-[var(--denoise-copper)] transition-colors shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
