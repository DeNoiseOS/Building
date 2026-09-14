"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeLayout, WidgetInstance } from "@/lib/widgets/schema";
import type { WidgetData } from "@/lib/widgets/data/fetch-all";
import { widgetDefinition } from "@/lib/widgets/registry";
import { WidgetFrame } from "./widget-frame";
import { WidgetBody } from "./widget-body";
import { useDensity } from "./use-density";
import {
  clampWithinGrid,
  GRID_COLS,
  nextFreeRow,
  resolveCollisions,
} from "./layout-utils";
import {
  addWidgetAction,
  duplicateWidgetAction,
  removeWidgetAction,
  replaceLayoutAction,
  resetLayoutAction,
} from "@/lib/widgets/layout-actions";
import { AddWidgetSheet } from "./add-widget-sheet";
import { ConfigureSheet } from "./configure-sheet";

const ROW_HEIGHT = 96; // px
const GAP = 12; // px

/** Cheap identity signal — the sorted list of instance ids. Used so
 *  the client only re-adopts the server payload when the SET of
 *  widgets actually changes, not on every parent re-render. */
function layoutFingerprint(l: HomeLayout): string {
  return l.widgets
    .map((w) => w.id)
    .sort()
    .join("|");
}

/**
 * V0.28 Phase B — Home Command Center canvas.
 *
 * Client component. Hydrated with the server-fetched layout + widget
 * data map. Owns:
 *   • drag-to-move (via dnd-kit)
 *   • pointer-based resize handle
 *   • optimistic local layout state
 *   • collision resolution (push-down)
 *   • add/duplicate/remove/reconfigure lifecycle
 *   • persistence via server actions (debounced batches for
 *     drag/resize, immediate for lifecycle events)
 */
export function HomeCanvas({
  initialLayout,
  initialData,
}: {
  initialLayout: HomeLayout;
  initialData: Record<string, WidgetData>;
}) {
  const [layout, setLayout] = useState<HomeLayout>(initialLayout);
  // When the server returns a fresh payload (via router.refresh after
  // add/duplicate/remove/reconfigure), adopt it so the optimistic
  // tmp- ids get replaced by their real persisted counterparts.
  useEffect(() => {
    setLayout(initialLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutFingerprint(initialLayout)]);
  const [dragId, setDragId] = useState<string | null>(null);
  // Pixel dimensions of the source cell captured on drag start —
  // used to size the DragOverlay ghost so it matches the widget's
  // real footprint instead of a computed percent (which was giving
  // us a stretched rectangle).
  const [dragRect, setDragRect] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<null | {
    id: string;
    origin: { x: number; y: number };
    startW: number;
    startH: number;
    cellW: number;
    // Pixel dimensions of the source cell captured at resize start —
    // used as the anchor for the pixel-precise preview overlay.
    startPxW: number;
    startPxH: number;
    startTop: number;
    startLeft: number;
    // Live pixel preview updated on every pointermove; when set, the
    // WidgetCell for this id renders position:absolute with these
    // exact pixel dimensions instead of using the grid.
    previewW: number;
    previewH: number;
    // Live SNAP target expressed in grid units — the size the widget
    // WILL become on release. Kept separate from previewW/H so the
    // ghost outline can render on the grid at those coords.
    snapW: number;
    snapH: number;
  }>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const dataMap = initialData; // never mutated on the client

  // dnd-kit sensors — small activation distance so clicks on menu/links don't trigger drag
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // Persist layout changes. Fire-and-forget async — no useTransition
  // wrapper (React 19's startTransition + async has subtle timing
  // that fires spurious "couldn't save" toasts even when the write
  // succeeds).
  const persistLayout = useCallback((next: HomeLayout) => {
    void replaceLayoutAction(next).catch((err) => {
      console.error("[canvas] save failed:", err);
      toast.error("Couldn't save layout");
    });
  }, []);

  // ── drag ──────────────────────────────────────────────────────────

  const onDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragId(id);
    // Measure the source cell so the overlay renders at exact size.
    const el = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setDragRect({ width: r.width, height: r.height });
    }
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDragId(null);
      setDragRect(null);
      const id = String(e.active.id);
      const src = layout.widgets.find((w) => w.id === id);
      if (!src) return;

      const gridEl = gridRef.current;
      if (!gridEl) return;
      const cellW = (gridEl.clientWidth - GAP * (GRID_COLS - 1)) / GRID_COLS;
      const deltaCols = Math.round(e.delta.x / (cellW + GAP));
      const deltaRows = Math.round(e.delta.y / (ROW_HEIGHT + GAP));

      if (deltaCols === 0 && deltaRows === 0) return;

      const clamped = clampWithinGrid({
        x: src.x + deltaCols,
        y: src.y + deltaRows,
        w: src.w,
        h: src.h,
      });

      const nextWidgets = layout.widgets.map((w) =>
        w.id === id ? ({ ...w, ...clamped } as WidgetInstance) : w,
      );
      const resolved = resolveCollisions(nextWidgets, id);
      const next: HomeLayout = { version: 1, widgets: resolved };
      setLayout(next);
      persistLayout(next);
    },
    [layout, persistLayout],
  );

  // ── resize ────────────────────────────────────────────────────────

  const onResizePointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const src = layout.widgets.find((w) => w.id === id);
      if (!src) return;
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const cellW = (gridEl.clientWidth - GAP * (GRID_COLS - 1)) / GRID_COLS;
      // Capture the source cell's pixel rect so the preview overlay
      // starts exactly where the widget currently sits.
      const cellEl = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
      const cellRect = cellEl?.getBoundingClientRect();
      const gridRect = gridEl.getBoundingClientRect();
      const startPxW = cellRect?.width ?? cellW * src.w + GAP * (src.w - 1);
      const startPxH = cellRect?.height ?? ROW_HEIGHT * src.h + GAP * (src.h - 1);
      const startTop = (cellRect?.top ?? 0) - gridRect.top;
      const startLeft = (cellRect?.left ?? 0) - gridRect.left;
      setResizeState({
        id,
        origin: { x: e.clientX, y: e.clientY },
        startW: src.w,
        startH: src.h,
        cellW,
        startPxW,
        startPxH,
        startTop,
        startLeft,
        previewW: startPxW,
        previewH: startPxH,
        snapW: src.w,
        snapH: src.h,
      });
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
    },
    [layout],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeState) return;
      const dx = e.clientX - resizeState.origin.x;
      const dy = e.clientY - resizeState.origin.y;
      const src = layout.widgets.find((w) => w.id === resizeState.id);
      if (!src) return;
      const def = widgetDefinition(src.type);
      const minPxW = def.minW * resizeState.cellW + (def.minW - 1) * GAP;
      const maxPxW = (def.maxW ?? 12) * resizeState.cellW + ((def.maxW ?? 12) - 1) * GAP;
      const minPxH = def.minH * ROW_HEIGHT + (def.minH - 1) * GAP;
      const maxPxH = (def.maxH ?? 24) * ROW_HEIGHT + ((def.maxH ?? 24) - 1) * GAP;
      const previewW = Math.max(minPxW, Math.min(maxPxW, resizeState.startPxW + dx));
      const previewH = Math.max(minPxH, Math.min(maxPxH, resizeState.startPxH + dy));
      // Snap size in grid units the widget will land at on release.
      const snapW = Math.max(
        def.minW,
        Math.min(
          def.maxW ?? 12,
          Math.round((previewW + GAP) / (resizeState.cellW + GAP)),
        ),
      );
      const snapH = Math.max(
        def.minH,
        Math.min(def.maxH ?? 24, Math.round((previewH + GAP) / (ROW_HEIGHT + GAP))),
      );
      setResizeState((prev) =>
        prev ? { ...prev, previewW, previewH, snapW, snapH } : prev,
      );
    },
    [resizeState, layout],
  );

  const onResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeState) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      const src = layout.widgets.find((w) => w.id === resizeState.id);
      const snapshot = resizeState;
      setResizeState(null); // clear the pixel overlay
      if (!src) return;
      const clamped = clampWithinGrid({
        x: src.x,
        y: src.y,
        w: snapshot.snapW,
        h: snapshot.snapH,
      });
      // Only touch state / persist if something changed.
      if (clamped.w === src.w && clamped.h === src.h && clamped.x === src.x) {
        return;
      }
      // Compute the next layout imperatively BEFORE any state setter —
      // never call startTransition (via persistLayout) inside a
      // setState updater; React 19 treats that as "during rendering".
      const updatedWidgets = layout.widgets.map((w) =>
        w.id === snapshot.id ? ({ ...w, ...clamped } as WidgetInstance) : w,
      );
      const resolved = resolveCollisions(updatedWidgets, snapshot.id);
      const next: HomeLayout = { version: 1, widgets: resolved };
      setLayout(next);
      persistLayout(next);
    },
    [resizeState, layout, persistLayout],
  );

  // ── lifecycle ─────────────────────────────────────────────────────

  const handleAdd = useCallback(
    (type: WidgetInstance["type"]) => {
      setAddOpen(false);
      // Optimistic local placeholder so the widget appears instantly.
      const def = widgetDefinition(type);
      const optimistic: WidgetInstance = {
        id: `tmp-${Date.now()}`,
        x: 0,
        y: nextFreeRow(layout.widgets),
        w: def.defaultW,
        h: def.defaultH,
        ...def.defaultConfig(),
      } as WidgetInstance;
      setLayout((prev) => ({
        version: 1,
        widgets: [...prev.widgets, optimistic],
      }));
      addWidgetAction({ type })
        .then(() => router.refresh())
        .catch((err) => {
          console.error(err);
          toast.error("Couldn't add widget");
          setLayout((prev) => ({
            version: 1,
            widgets: prev.widgets.filter((w) => w.id !== optimistic.id),
          }));
        });
    },
    [layout, router],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const src = layout.widgets.find((w) => w.id === id);
      if (!src) return;
      const clone: WidgetInstance = {
        ...src,
        id: `tmp-${Date.now()}`,
        y: nextFreeRow(layout.widgets),
      } as WidgetInstance;
      setLayout((prev) => ({
        version: 1,
        widgets: [...prev.widgets, clone],
      }));
      duplicateWidgetAction(id)
        .then(() => router.refresh())
        .catch((err) => {
          console.error(err);
          toast.error("Couldn't duplicate");
          setLayout((prev) => ({
            version: 1,
            widgets: prev.widgets.filter((w) => w.id !== clone.id),
          }));
        });
    },
    [layout, router],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setLayout((prev) => ({
        version: 1,
        widgets: prev.widgets.filter((w) => w.id !== id),
      }));
      removeWidgetAction(id)
        .then(() => router.refresh())
        .catch((err) => {
          console.error(err);
          toast.error("Couldn't remove");
        });
    },
    [router],
  );

  const handleReset = useCallback(() => {
    resetLayoutAction()
      .then(() => router.refresh())
      .catch((err) => {
        console.error(err);
        toast.error("Couldn't reset");
      });
  }, [router]);

  const configureTarget = configureId
    ? (layout.widgets.find((w) => w.id === configureId) ?? null)
    : null;

  const dragOverlayWidget = dragId ? layout.widgets.find((w) => w.id === dragId) : null;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.20em] text-[var(--denoise-cream-muted)]">
          <span>Command Center</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)] hover:text-[var(--denoise-copper)] px-2 py-1 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-home)] border border-[var(--denoise-border-strong)] bg-transparent hover:bg-[var(--denoise-surface-2)] text-[12px] text-[var(--denoise-cream)] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Widget
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div
          ref={gridRef}
          className={cn(
            "relative", // anchor for pixel-precise resize overlay
            "grid grid-cols-1 md:grid-cols-12 home-canvas-grid",
          )}
          style={{
            gap: `${GAP}px`,
            gridAutoRows: `${ROW_HEIGHT}px`,
          }}
          data-dragging={dragId ? "true" : "false"}
          data-resizing={resizeState ? "true" : "false"}
          onPointerMove={resizeState ? onResizePointerMove : undefined}
          onPointerUp={resizeState ? onResizePointerUp : undefined}
        >
          {layout.widgets.map((w) => (
            <WidgetCell
              key={w.id}
              instance={w}
              data={dataMap[w.id]}
              onConfigure={() => setConfigureId(w.id)}
              onDuplicate={() => handleDuplicate(w.id)}
              onRemove={() => handleRemove(w.id)}
              onResizePointerDown={onResizePointerDown(w.id)}
              isBeingDragged={dragId === w.id}
              resizeOverlay={
                resizeState?.id === w.id
                  ? {
                      width: resizeState.previewW,
                      height: resizeState.previewH,
                      top: resizeState.startTop,
                      left: resizeState.startLeft,
                    }
                  : null
              }
            />
          ))}
          {resizeState && (
            <SnapGhost
              x={(layout.widgets.find((w) => w.id === resizeState.id)?.x ?? 0) + 1}
              y={(layout.widgets.find((w) => w.id === resizeState.id)?.y ?? 0) + 1}
              w={resizeState.snapW}
              h={resizeState.snapH}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragOverlayWidget && dragRect && (
            <div
              style={{
                width: dragRect.width,
                height: dragRect.height,
              }}
              className="opacity-90"
            >
              <WidgetFrame
                instance={dragOverlayWidget}
                isDragging={true}
                onConfigure={() => {}}
                onDuplicate={() => {}}
                onRemove={() => {}}
                onResizePointerDown={() => {}}
                dragHandleProps={{}}
              >
                <div className="h-full" />
              </WidgetFrame>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <AddWidgetSheet open={addOpen} onOpenChange={setAddOpen} onPick={handleAdd} />
      <ConfigureSheet instance={configureTarget} onClose={() => setConfigureId(null)} />
    </>
  );
}

// ── one widget cell ─────────────────────────────────────────────────

function WidgetCell({
  instance,
  data,
  onConfigure,
  onDuplicate,
  onRemove,
  onResizePointerDown,
  isBeingDragged,
  resizeOverlay,
}: {
  instance: WidgetInstance;
  data: WidgetData | undefined;
  onConfigure: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  isBeingDragged: boolean;
  resizeOverlay: {
    width: number;
    height: number;
    top: number;
    left: number;
  } | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: instance.id,
  });
  const density = useDensity(
    resizeOverlay ? Math.max(1, Math.round(resizeOverlay.width / 108)) : instance.w,
    resizeOverlay ? Math.max(1, Math.round(resizeOverlay.height / 108)) : instance.h,
  );

  const style: React.CSSProperties = useMemo(() => {
    if (resizeOverlay) {
      // Pixel-precise overlay — floats above the grid; original grid
      // slot stays reserved via the SnapGhost.
      return {
        position: "absolute",
        top: resizeOverlay.top,
        left: resizeOverlay.left,
        width: resizeOverlay.width,
        height: resizeOverlay.height,
        zIndex: 20,
        transition: "none",
      };
    }
    return {
      gridColumn: `${instance.x + 1} / span ${instance.w}`,
      gridRow: `${instance.y + 1} / span ${instance.h}`,
      opacity: isBeingDragged || isDragging ? 0 : 1,
    };
  }, [
    instance.x,
    instance.y,
    instance.w,
    instance.h,
    isBeingDragged,
    isDragging,
    resizeOverlay,
  ]);

  return (
    <div style={style} className="home-widget-cell" data-widget-id={instance.id}>
      <WidgetFrame
        instance={instance}
        isDragging={false}
        onConfigure={onConfigure}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onResizePointerDown={onResizePointerDown}
        dragHandleProps={{
          ref: setNodeRef as React.Ref<HTMLElement>,
          ...attributes,
          ...listeners,
        }}
      >
        <WidgetBody instance={instance} data={data} density={density} />
      </WidgetFrame>
    </div>
  );
}

// ── snap ghost — visualises where the resize will land ──────────────

function SnapGhost({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div
      aria-hidden
      style={{
        gridColumn: `${x} / span ${w}`,
        gridRow: `${y} / span ${h}`,
        pointerEvents: "none",
        zIndex: 5,
      }}
      className="rounded-[var(--radius-home)] border-2 border-dashed border-[var(--denoise-copper)] bg-[var(--denoise-copper-muted)]"
    />
  );
}
