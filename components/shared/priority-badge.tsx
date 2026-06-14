import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS } from "@/lib/roles";

const STYLES: Record<string, string> = {
  low: "bg-white/[0.03] text-muted-foreground border-transparent",
  medium:
    "bg-amber-400/10 text-amber-300 border-amber-400/20",
  high:
    "bg-red-400/10 text-red-300 border-red-400/25",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-[10px] py-0.5 px-2",
        STYLES[priority] ?? "",
        className
      )}
    >
      {TASK_PRIORITY_LABELS[priority] ?? priority}
    </Badge>
  );
}
