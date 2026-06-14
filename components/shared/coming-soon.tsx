import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional list of features that will arrive when this surface ships. */
  features?: string[];
  /** When set, shown as a subtle "shipping in V…" pill. */
  shippingIn?: string;
}

export function ComingSoon({
  icon: Icon,
  title,
  description,
  features = [],
  shippingIn,
}: ComingSoonProps) {
  return (
    <div className="rounded-2xl bg-card/40 border border-dashed border-white/[0.08] p-10 sm:p-14 flex flex-col items-center text-center gap-5 max-w-3xl mx-auto">
      <div className="relative">
        <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <Sparkles className="absolute -top-1 -right-1.5 h-3.5 w-3.5 text-primary/80" />
      </div>

      <div className="space-y-2 max-w-md">
        <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {features.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full mt-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="text-xs px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted-foreground text-left"
            >
              {feature}
            </div>
          ))}
        </div>
      )}

      {shippingIn && (
        <div className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold border border-primary/20 bg-primary/10 px-3 py-1 rounded-full">
          {shippingIn}
        </div>
      )}
    </div>
  );
}
