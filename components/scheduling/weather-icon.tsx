"use client";

import { Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WEATHER_ICONS } from "./weather-icons";

// Re-export the server-safe helpers so existing imports of
// "./weather-icon" keep working after the split.
export { WEATHER_ICONS, weatherIconFor } from "./weather-icons";

/**
 * V0.30 — Weather icon picker (client-only UI).
 *
 * The resolver + registry live in weather-icons.ts so server
 * components (CallSheetView) can import them safely.
 */

export function WeatherIconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const active = WEATHER_ICONS.find((w) => w.key === value);
  const Icon = active?.icon ?? Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-8 w-10 rounded-md border border-[var(--denoise-border)] bg-[var(--denoise-bg)] flex items-center justify-center transition-colors",
            !disabled &&
              "hover:border-[var(--denoise-copper-border)] hover:text-[var(--denoise-copper)]",
            !active && "text-[var(--denoise-cream-muted)]",
          )}
          aria-label="Weather icon"
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="grid grid-cols-3 gap-1 p-1.5 min-w-[160px]"
      >
        {WEATHER_ICONS.map((w) => {
          const WIcon = w.icon;
          const on = w.key === value;
          return (
            <DropdownMenuItem
              key={w.key}
              onSelect={() => onChange(on ? null : w.key)}
              className={cn(
                "flex items-center justify-center h-9 w-9 p-0 rounded-md",
                on && "bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]",
              )}
              title={w.label}
            >
              <WIcon className="h-4 w-4" />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
