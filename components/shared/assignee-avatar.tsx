import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AssigneeAvatarProps {
  assignee: { id: string; name: string } | null;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

function initialsFrom(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SIZE: Record<NonNullable<AssigneeAvatarProps["size"]>, string> = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-[11px]",
  md: "h-8 w-8 text-xs",
};

/**
 * Renders an assignee's avatar (initials) or an "Unassigned" indicator when
 * null. In V0.1 the only possible assignee is the current user; V0.2's
 * collaboration layer turns this into a real photo / picker without touching
 * the surface that renders it.
 */
export function AssigneeAvatar({
  assignee,
  size = "sm",
  showLabel = false,
  className,
}: AssigneeAvatarProps) {
  if (!assignee) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-muted-foreground",
          className
        )}
      >
        <div
          className={cn(
            "rounded-full border border-dashed border-muted-foreground/40",
            SIZE[size]
          )}
        />
        {showLabel && <span className="text-xs">Unassigned</span>}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Avatar className={SIZE[size]}>
        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
          {initialsFrom(assignee.name)}
        </AvatarFallback>
      </Avatar>
      {showLabel && (
        <span className="text-xs text-foreground truncate">
          {assignee.name}
        </span>
      )}
    </div>
  );
}
