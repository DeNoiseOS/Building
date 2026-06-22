import { Badge } from "@/components/ui/badge";
import { SCENE_STATUS_LABELS } from "@/lib/scene-data";

const COLOR: Record<string, string> = {
  draft: "bg-white/[0.04] border-white/[0.06] text-muted-foreground",
  planning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  ready: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  scheduled: "bg-primary/10 border-primary/30 text-primary",
  shot: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  completed: "bg-emerald-600/15 border-emerald-500/40 text-emerald-200",
};

export function SceneStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`${COLOR[status] ?? COLOR.draft} text-[10px]`}
    >
      {SCENE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
