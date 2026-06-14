import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS } from "@/lib/roles";

const STYLES: Record<string, string> = {
  todo: "bg-white/[0.04] text-foreground/80 border-white/[0.06]",
  in_progress:
    "bg-sky-400/10 text-sky-300 border-sky-400/25",
  done: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-[10px] py-0.5 px-2",
        STYLES[status] ?? "",
        className
      )}
    >
      {TASK_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
