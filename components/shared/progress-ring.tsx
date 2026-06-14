import { cn } from "@/lib/utils";

interface ProgressRingProps {
  percent: number;
  size?: number;
  thickness?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  label?: string;
  labelClassName?: string;
}

/**
 * Circular progress ring. Used in the Project Health card and other
 * dashboard surfaces.
 */
export function ProgressRing({
  percent,
  size = 140,
  thickness = 10,
  className,
  trackClassName,
  indicatorClassName,
  label,
  labelClassName,
}: ProgressRingProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className={cn("stroke-white/[0.06]", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "stroke-primary transition-[stroke-dashoffset] duration-500",
            indicatorClassName
          )}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
          labelClassName
        )}
      >
        <span className="text-3xl font-semibold tracking-tight">
          {Math.round(clamped)}%
        </span>
        {label && (
          <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
        )}
      </div>
    </div>
  );
}
