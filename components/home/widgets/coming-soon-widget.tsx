import type { ComingSoonConfig } from "@/lib/widgets/schema";
import { widgetDefinition } from "@/lib/widgets/registry";
import type { WidgetType } from "@/lib/widgets/schema";

/**
 * V0.28 Phase B — Placeholder for widget types whose real renderer
 * ships in a later phase. Shows the icon + name + a small "Coming
 * soon" tag. No fabricated content, no fake data.
 */
export function ComingSoonWidget({
  type,
  config,
}: {
  type: WidgetType;
  config: ComingSoonConfig;
}) {
  const def = widgetDefinition(type);
  const Icon = def.icon;
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 px-4 py-3 text-center">
      <span className="h-8 w-8 rounded-md border border-[var(--denoise-border-strong)] bg-[var(--denoise-surface-2)] flex items-center justify-center text-[var(--denoise-cream-muted)]">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-[13px] text-[var(--denoise-cream)] font-medium">
        {config.label}
      </p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-copper)]">
        Coming Soon
      </p>
    </div>
  );
}
