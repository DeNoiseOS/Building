import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * V0.27.1 — Compact editorial section header. Tighter than V0.27:
 * single-line title (uppercase caption style) with optional count chip
 * and right-side link. No large subtitle by default — descriptions live
 * in the section body when needed.
 */
export function SectionHeader({
  title,
  count,
  href,
  hrefLabel = "View all",
  className,
}: {
  title: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--denoise-border)]",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-[10px] uppercase tracking-[0.20em] font-medium text-[var(--denoise-cream-muted)]">
          {title}
        </h2>
        {typeof count === "number" && count > 0 && (
          <span className="inline-flex items-center justify-center text-[10px] font-medium h-4 min-w-[16px] px-1 rounded-sm bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)] tabular-nums">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="text-[11px] text-[var(--denoise-cream-muted)] hover:text-[var(--denoise-copper)] inline-flex items-center gap-1 transition-colors shrink-0"
        >
          {hrefLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/**
 * Base panel every Home section sits on. Industrial matte surface, thin
 * border, tight radius. No glass, no shadow.
 */
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)] flex flex-col",
        className
      )}
    >
      {children}
    </section>
  );
}
