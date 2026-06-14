import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectHealth } from "@/lib/project-stats";

const STYLES: Record<
  ProjectHealth,
  { label: string; className: string; dot: string }
> = {
  healthy: {
    label: "On Track",
    className:
      "bg-emerald-400/10 text-emerald-300 border-emerald-400/25 backdrop-blur-md",
    dot: "bg-emerald-400 shadow-[0_0_8px_oklch(0.75_0.18_155_/_0.7)]",
  },
  watch: {
    label: "Watch",
    className:
      "bg-amber-400/10 text-amber-300 border-amber-400/25 backdrop-blur-md",
    dot: "bg-amber-400 shadow-[0_0_8px_oklch(0.78_0.16_80_/_0.7)]",
  },
  at_risk: {
    label: "At Risk",
    className:
      "bg-red-400/10 text-red-300 border-red-400/25 backdrop-blur-md",
    dot: "bg-red-400 shadow-[0_0_8px_oklch(0.65_0.20_25_/_0.7)]",
  },
};

export function HealthBadge({
  health,
  className,
}: {
  health: ProjectHealth;
  className?: string;
}) {
  const s = STYLES[health];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium text-[10px] py-0.5 px-2",
        s.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </Badge>
  );
}

export function HealthDot({ health }: { health: ProjectHealth }) {
  const s = STYLES[health];
  return <span className={cn("h-2 w-2 rounded-full inline-block", s.dot)} />;
}
