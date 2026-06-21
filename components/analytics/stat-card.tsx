import { cn } from "@/lib/utils";

/**
 * V0.15 — Reusable analytics stat card. Pure server component;
 * shows a label, primary value, optional sub-label, and optional
 * accent color.
 */
export function StatCard({
  label,
  value,
  hint,
  accent = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "default" | "primary" | "good" | "warn" | "danger";
}) {
  const valueClass = {
    default: "text-foreground",
    primary: "text-primary",
    good: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-red-300",
  }[accent];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card/40 px-4 py-3 shadow-soft">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
