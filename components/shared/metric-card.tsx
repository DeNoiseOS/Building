import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
}

const TONE_STYLES: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "bg-white/[0.04] text-foreground border-white/[0.06]",
  primary: "bg-primary/15 text-primary border-primary/20",
  success:
    "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/20",
  warning:
    "bg-amber-500/10 text-amber-300 border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/20",
  destructive:
    "bg-red-500/10 text-red-300 border-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:border-red-400/20",
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: MetricCardProps) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] p-5 shadow-soft hover:shadow-hover transition-shadow">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <span
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center border",
            TONE_STYLES[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-3xl font-semibold mt-3 tracking-tight">{value}</p>
      {hint && (
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      )}
    </div>
  );
}
