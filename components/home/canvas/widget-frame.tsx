"use client";

import { useState } from "react";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetDefinition } from "@/lib/widgets/registry";
import type { WidgetInstance } from "@/lib/widgets/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * V0.28 Phase B — Widget shell.
 *
 * The chrome around every widget body: title strip with icon,
 * overflow menu (Configure / Duplicate / Remove) and a bottom-right
 * resize handle. All controls are quiet by default; they light up on
 * hover/focus so the Home reads as content, not a dashboard-builder
 * UI.
 *
 * The frame itself is NOT draggable — the canvas wires drag handling
 * onto the shell via props (`dragHandleProps`) so dnd-kit's sensors
 * can attach to a specific area without capturing pointer events on
 * links inside the body.
 */
export function WidgetFrame({
  instance,
  isDragging,
  onConfigure,
  onDuplicate,
  onRemove,
  onResizePointerDown,
  dragHandleProps,
  children,
}: {
  instance: WidgetInstance;
  isDragging: boolean;
  onConfigure: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  dragHandleProps: React.HTMLAttributes<HTMLElement> & {
    ref?: React.Ref<HTMLElement>;
  };
  children: React.ReactNode;
}) {
  const def = widgetDefinition(instance.type);
  const Icon = def.icon;
  const [hovered, setHovered] = useState(false);
  const title = instance.title ?? def.name;

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-[var(--radius-home)] border bg-[var(--denoise-surface)] flex flex-col overflow-hidden transition-colors",
        isDragging
          ? "border-[var(--denoise-copper-border)] shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)]"
          : "border-[var(--denoise-border)]",
        hovered && !isDragging && "border-[var(--denoise-border-strong)]"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Title strip — drag handle */}
      <header
        {...dragHandleProps}
        className={cn(
          "h-8 px-3 flex items-center gap-2 border-b border-[var(--denoise-border)] select-none touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <Icon className="h-3 w-3 text-[var(--denoise-cream-muted)] shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)] truncate flex-1">
          {title}
        </span>
        <GripVertical
          className={cn(
            "h-3 w-3 shrink-0 transition-opacity",
            hovered ? "opacity-40" : "opacity-0"
          )}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "h-5 w-5 rounded flex items-center justify-center transition-opacity",
                hovered ? "opacity-70 hover:opacity-100" : "opacity-0",
                "hover:bg-white/[0.05]"
              )}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Widget menu"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onSelect={onConfigure}>
              Configure
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onRemove}
              className="text-red-300 focus:text-red-200 focus:bg-red-500/10"
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 relative">{children}</div>

      {/* Resize handle — bottom right */}
      <button
        type="button"
        aria-label="Resize"
        onPointerDown={onResizePointerDown}
        className={cn(
          "absolute bottom-0 right-0 h-4 w-4 cursor-se-resize z-10 transition-opacity",
          hovered ? "opacity-100" : "opacity-0"
        )}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4">
          <path
            d="M15 5 L15 15 L5 15"
            stroke="var(--denoise-copper)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M15 10 L10 15"
            stroke="var(--denoise-copper)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>
      </button>
    </div>
  );
}
