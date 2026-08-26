"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  widgetsByCategory,
  type WidgetCategory,
  type WidgetDefinition,
} from "@/lib/widgets/registry";
import type { WidgetType } from "@/lib/widgets/schema";

const CATEGORY_ORDER: WidgetCategory[] = [
  "Work",
  "Production",
  "Finance",
  "Team",
  "Content",
  "System",
  "AI",
];

/**
 * V0.28 Phase B — Add-widget picker.
 *
 * Categorised list of every registered widget. Implemented widgets are
 * interactive; coming-soon widgets are still selectable so a user can
 * drop them onto their canvas as reserved placeholders — they render
 * with the ComingSoonWidget until their real renderer ships.
 */
export function AddWidgetSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: WidgetType) => void;
}) {
  const [query, setQuery] = useState("");
  const byCategory = useMemo(() => widgetsByCategory(), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return byCategory;
    const q = query.trim().toLowerCase();
    const out: Record<WidgetCategory, WidgetDefinition[]> = {
      Work: [],
      Production: [],
      Finance: [],
      Team: [],
      Content: [],
      System: [],
      AI: [],
    };
    for (const cat of CATEGORY_ORDER) {
      out[cat] = byCategory[cat].filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
      );
    }
    return out;
  }, [byCategory, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[440px] sm:max-w-[440px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
      >
        <SheetHeader className="border-b border-[var(--denoise-border)]">
          <SheetTitle className="text-[var(--denoise-cream)]">
            Add Widget
          </SheetTitle>
          <SheetDescription className="text-[var(--denoise-cream-muted)] text-[12px]">
            Choose a module to add to your Command Center.
          </SheetDescription>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--denoise-cream-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search widgets…"
              className="h-9 pl-8 bg-[var(--denoise-bg)] border-[var(--denoise-border)] text-[13px]"
            />
          </div>
        </SheetHeader>

        <div className="overflow-auto flex-1 p-4 space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const items = filtered[cat];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-[10px] uppercase tracking-[0.20em] text-[var(--denoise-cream-muted)] mb-2">
                  {cat}
                </h3>
                <ul className="grid grid-cols-2 gap-2">
                  {items.map((def) => {
                    const Icon = def.icon;
                    return (
                      <li key={def.type}>
                        <button
                          type="button"
                          onClick={() => onPick(def.type)}
                          className={cn(
                            "w-full text-left rounded-[var(--radius-home)] border p-3 transition-colors group",
                            "border-[var(--denoise-border)] bg-[var(--denoise-surface-2)] hover:border-[var(--denoise-copper-border)] hover:bg-[var(--denoise-surface)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                                def.implemented
                                  ? "bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]"
                                  : "bg-white/[0.04] text-[var(--denoise-cream-muted)]"
                              )}
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                            <span className="text-[13px] font-medium text-[var(--denoise-cream)] truncate">
                              {def.name}
                            </span>
                            {!def.implemented && (
                              <span className="ml-auto text-[9px] uppercase tracking-[0.14em] text-[var(--denoise-copper)]/70">
                                Soon
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--denoise-cream-muted)] mt-1.5 leading-snug line-clamp-2">
                            {def.description}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
