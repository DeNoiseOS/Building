"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Camera,
  Coffee,
  Film,
  GripVertical,
  Hammer,
  MapPin,
  Plus,
  Timer,
  Trash2,
  Truck,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FileUploader } from "@/components/shared/file-uploader";
import {
  addSceneToShootDayAction,
  addNonSceneItemAction,
  deleteShootDayItemAction,
  reorderShootDayItemsAction,
  updateShootDayAction,
  updateShootDayItemAction,
  deleteShootDayAction,
  updateSceneShootMetaAction,
} from "@/lib/scheduling/actions";
import { WeatherIconPicker, weatherIconFor } from "./weather-icon";

interface UnscheduledScene {
  id: string;
  number: string;
  title: string;
  location: string | null;
  type: string;
  timeOfDay: string;
}

export type ShootDayItemRow = {
  id: string;
  kind: "scene" | "prep" | "break" | "move" | "meal";
  order: number;
  label: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  scene?: {
    id: string;
    number: string;
    title: string;
    type: string;
    timeOfDay: string;
    location: string | null;
    estimatedMinutes: number | null;
    pagesCount: string | null;
    castCount: number;
    assetCount: number;
  };
};

interface Props {
  projectId: string;
  shootDay: {
    id: string;
    date: string;
    label: string | null;
    generalCallTime: string | null;
    wrapTime: string | null;
    locationName: string | null;
    locationAddress: string | null;
    weather: string | null;
    weatherIcon: string | null;
    sunrise: string | null;
    sunset: string | null;
    hospitalName: string | null;
    hospitalPhone: string | null;
    emergencyContact: string | null;
    generalNotes: string | null;
    productionLogoUrl: string | null;
    clientLogoUrl: string | null;
  };
  items: ShootDayItemRow[];
  unscheduled: UnscheduledScene[];
  /** Location auto-filled from the first scene when the shoot day
   *  has no explicit locationName set. Shown as a hint. */
  autoLocationHint: string | null;
  canEdit: boolean;
}

/**
 * V0.30 — Shoot Day editor.
 *
 * Timeline is a mixed list of items (scene / prep / break / move /
 * meal). Sortable via dnd-kit. Add buttons let the AD build up the
 * day incrementally.
 */
export function ShootDayEditor({
  projectId,
  shootDay,
  items: initialItems,
  unscheduled,
  autoLocationHint,
  canEdit,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShootDayItemRow | null>(null);
  const [editSceneMeta, setEditSceneMeta] = useState<ShootDayItemRow["scene"] | null>(
    null,
  );
  const [savingCount, setSavingCount] = useState(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function withSaving<T>(fn: () => Promise<T>): Promise<T> {
    setSavingCount((c) => c + 1);
    return fn().finally(() => setSavingCount((c) => c - 1));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    withSaving(() =>
      reorderShootDayItemsAction({
        shootDayId: shootDay.id,
        orderedItemIds: next.map((i) => i.id),
      }),
    ).catch((err) => {
      console.error(err);
      toast.error("Couldn't save order");
    });
  }

  function persistMetaPatch(patch: Partial<Props["shootDay"]>) {
    withSaving(() =>
      updateShootDayAction({
        shootDayId: shootDay.id,
        patch: patch as Parameters<typeof updateShootDayAction>[0]["patch"],
      }),
    ).catch((err) => {
      console.error(err);
      toast.error("Couldn't save changes");
    });
  }

  async function addScene(sceneId: string) {
    try {
      await addSceneToShootDayAction({ sceneId, shootDayId: shootDay.id });
      setPickerOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add scene");
    }
  }

  async function addNonScene(kind: "prep" | "break" | "move" | "meal", label: string) {
    try {
      await addNonSceneItemAction({
        shootDayId: shootDay.id,
        kind,
        label,
      });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add item");
    }
  }

  async function removeItem(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await deleteShootDayItemAction(itemId);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't remove");
    }
  }

  async function deleteDay() {
    if (!confirm("Delete this shoot day? Scenes go back to unscheduled.")) return;
    try {
      await deleteShootDayAction(shootDay.id);
      router.push(`/projects/${projectId}/scheduling`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete");
    }
  }

  const effectiveLocation = shootDay.locationName ?? autoLocationHint;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--denoise-copper)]">
            Shoot Day
            {savingCount > 0 && (
              <span className="ml-2 text-[var(--denoise-cream-muted)] normal-case tracking-normal">
                · saving…
              </span>
            )}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--denoise-cream)] mt-1 tabular-nums">
            {format(new Date(shootDay.date), "EEEE, MMM d, yyyy")}
          </h1>
          {shootDay.label && (
            <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-1">
              {shootDay.label}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={deleteDay}
              className="h-9 text-red-300 hover:text-red-200 hover:bg-red-500/10 border-red-500/20"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Day
            </Button>
          )}
          <Button
            asChild
            className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
          >
            <a href={`/projects/${projectId}/scheduling/${shootDay.id}/call-sheet`}>
              <Camera className="h-4 w-4 mr-1.5" />
              Export Call Sheet
            </a>
          </Button>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
        {/* ── Metadata panel ────────────────────────────────────────── */}
        <div className="rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)] p-4 space-y-4 h-fit">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
            Day Details
          </p>

          {/* Logo uploads */}
          <div className="grid grid-cols-2 gap-3">
            <LogoZone
              label="Production Logo"
              currentUrl={shootDay.productionLogoUrl}
              projectId={projectId}
              shootDayId={shootDay.id}
              field="productionLogoUrl"
              canEdit={canEdit}
              onSave={(url) => persistMetaPatch({ productionLogoUrl: url })}
            />
            <LogoZone
              label="Client Logo"
              currentUrl={shootDay.clientLogoUrl}
              projectId={projectId}
              shootDayId={shootDay.id}
              field="clientLogoUrl"
              canEdit={canEdit}
              onSave={(url) => persistMetaPatch({ clientLogoUrl: url })}
            />
          </div>

          <Field label="Date">
            <Input
              type="date"
              disabled={!canEdit}
              defaultValue={shootDay.date.slice(0, 10)}
              onBlur={(e) =>
                e.target.value !== shootDay.date.slice(0, 10) &&
                persistMetaPatch({ date: e.target.value })
              }
              className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
          </Field>
          <Field label="Label">
            <Input
              disabled={!canEdit}
              defaultValue={shootDay.label ?? ""}
              onBlur={(e) => persistMetaPatch({ label: e.target.value || null })}
              placeholder="Day 3 of 12"
              className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Call Time">
              <Input
                type="time"
                disabled={!canEdit}
                defaultValue={shootDay.generalCallTime ?? ""}
                onBlur={(e) =>
                  persistMetaPatch({ generalCallTime: e.target.value || null })
                }
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </Field>
            <Field label="Wrap Time">
              <Input
                type="time"
                disabled={!canEdit}
                defaultValue={shootDay.wrapTime ?? ""}
                onBlur={(e) => persistMetaPatch({ wrapTime: e.target.value || null })}
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </Field>
          </div>
          <Field label="Location">
            <Input
              disabled={!canEdit}
              defaultValue={shootDay.locationName ?? ""}
              onBlur={(e) => persistMetaPatch({ locationName: e.target.value || null })}
              placeholder={autoLocationHint ?? "Warehouse 4"}
              className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
            {!shootDay.locationName && autoLocationHint && (
              <p className="text-[10px] text-[var(--denoise-cream-muted)] mt-1">
                Auto-fills from first scene: {autoLocationHint}
              </p>
            )}
          </Field>
          <Field label="Address">
            <Input
              disabled={!canEdit}
              defaultValue={shootDay.locationAddress ?? ""}
              onBlur={(e) =>
                persistMetaPatch({ locationAddress: e.target.value || null })
              }
              placeholder="Al Malqa, Riyadh · maps link"
              className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto_1fr_1fr] gap-3 items-end">
            <Field label="Weather">
              <Input
                disabled={!canEdit}
                defaultValue={shootDay.weather ?? ""}
                onBlur={(e) => persistMetaPatch({ weather: e.target.value || null })}
                placeholder="28°C"
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </Field>
            <div>
              <Label className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)] mb-1 block">
                Icon
              </Label>
              <WeatherIconPicker
                value={shootDay.weatherIcon}
                onChange={(v) => persistMetaPatch({ weatherIcon: v })}
                disabled={!canEdit}
              />
            </div>
            <Field label="Sunrise">
              <Input
                disabled={!canEdit}
                type="time"
                defaultValue={shootDay.sunrise ?? ""}
                onBlur={(e) => persistMetaPatch({ sunrise: e.target.value || null })}
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </Field>
            <Field label="Sunset">
              <Input
                disabled={!canEdit}
                type="time"
                defaultValue={shootDay.sunset ?? ""}
                onBlur={(e) => persistMetaPatch({ sunset: e.target.value || null })}
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </Field>
          </div>
          <Field label="Hospital">
            <div className="grid grid-cols-2 gap-2">
              <Input
                disabled={!canEdit}
                defaultValue={shootDay.hospitalName ?? ""}
                onBlur={(e) => persistMetaPatch({ hospitalName: e.target.value || null })}
                placeholder="Name"
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
              <Input
                disabled={!canEdit}
                defaultValue={shootDay.hospitalPhone ?? ""}
                onBlur={(e) =>
                  persistMetaPatch({ hospitalPhone: e.target.value || null })
                }
                placeholder="Phone"
                className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
              />
            </div>
          </Field>
          <Field label="Emergency Contact">
            <Input
              disabled={!canEdit}
              defaultValue={shootDay.emergencyContact ?? ""}
              onBlur={(e) =>
                persistMetaPatch({ emergencyContact: e.target.value || null })
              }
              placeholder="Name + phone"
              className="h-8 text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
          </Field>
          <Field label="Production Notes">
            <Textarea
              disabled={!canEdit}
              defaultValue={shootDay.generalNotes ?? ""}
              onBlur={(e) => persistMetaPatch({ generalNotes: e.target.value || null })}
              placeholder="Safety, VIP visits, weather callouts…"
              rows={4}
              className="text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)] resize-none"
            />
          </Field>
        </div>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <div className="rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)]">
          <div className="px-4 py-3 border-b border-[var(--denoise-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
                Timeline
              </p>
              <span className="text-[10px] tabular-nums text-[var(--denoise-copper)] bg-[var(--denoise-copper-muted)] px-1.5 rounded">
                {items.length}
              </span>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  className="h-8 text-[12px]"
                >
                  <Film className="h-3 w-3 mr-1" />
                  Add Scene
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 text-[12px]">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Other
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => addNonScene("prep", "Prep")}>
                      <Hammer className="h-3.5 w-3.5 mr-2" /> Prep
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addNonScene("break", "Break")}>
                      <Coffee className="h-3.5 w-3.5 mr-2" /> Break
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => addNonScene("move", "Loading + Moving")}
                    >
                      <Truck className="h-3.5 w-3.5 mr-2" /> Move
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addNonScene("meal", "Meal")}>
                      <Utensils className="h-3.5 w-3.5 mr-2" /> Meal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-[var(--denoise-cream-muted)]">
              No items yet. Add scenes, prep, breaks or moves to build the day.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="divide-y divide-[var(--denoise-border)]">
                  {items.map((it, idx) => (
                    <SortableRow
                      key={it.id}
                      item={it}
                      index={idx + 1}
                      canEdit={canEdit}
                      onEdit={() =>
                        it.kind === "scene" && it.scene
                          ? setEditSceneMeta(it.scene)
                          : setEditItem(it)
                      }
                      onRemove={() => removeItem(it.id)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Scene picker sheet */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent
          side="right"
          className="w-[440px] sm:max-w-[440px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
        >
          <SheetHeader className="border-b border-[var(--denoise-border)]">
            <SheetTitle className="text-[var(--denoise-cream)]">Add Scene</SheetTitle>
          </SheetHeader>
          <div className="overflow-auto flex-1 p-3">
            {unscheduled.length === 0 ? (
              <p className="text-[12px] text-[var(--denoise-cream-muted)] py-6 text-center">
                Every scene in this project is already scheduled.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {unscheduled.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => addScene(s.id)}
                      className="w-full text-left rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-bg)] hover:border-[var(--denoise-copper-border)] hover:bg-[var(--denoise-surface-2)] px-3 py-2.5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-medium text-[var(--denoise-cream)] tabular-nums">
                          #{s.number}
                        </span>
                        <span className="text-[13px] text-[var(--denoise-cream)] truncate flex-1">
                          {s.title}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-1 flex items-center gap-2">
                        <span>
                          {s.type} · {s.timeOfDay}
                        </span>
                        {s.location && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="truncate">{s.location}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Non-scene item editor */}
      <Sheet open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <SheetContent
          side="right"
          className="w-[380px] sm:max-w-[380px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
        >
          {editItem && (
            <NonSceneItemForm
              item={editItem}
              onDone={() => {
                setEditItem(null);
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Per-scene meta editor */}
      <Sheet open={!!editSceneMeta} onOpenChange={(o) => !o && setEditSceneMeta(null)}>
        <SheetContent
          side="right"
          className="w-[380px] sm:max-w-[380px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
        >
          {editSceneMeta && (
            <SceneMetaForm
              scene={editSceneMeta}
              onDone={() => {
                setEditSceneMeta(null);
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
        {label}
      </Label>
      {children}
    </div>
  );
}

function LogoZone({
  label,
  currentUrl,
  projectId,
  shootDayId,
  field,
  canEdit,
  onSave,
}: {
  label: string;
  currentUrl: string | null;
  projectId: string;
  shootDayId: string;
  field: "productionLogoUrl" | "clientLogoUrl";
  canEdit: boolean;
  onSave: (url: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
        {label}
      </Label>
      <div className="relative">
        {currentUrl ? (
          <div className="relative h-16 rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-white/[0.02] flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt={label}
              className="max-h-full max-w-full object-contain"
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => onSave(null)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                aria-label="Remove logo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : canEdit ? (
          <FileUploader
            projectId={projectId}
            ownerType="shoot_day"
            ownerId={`${shootDayId}:${field}`}
            accept="image/*"
            multiple={false}
            hideUrlPaste
            label="Upload"
            onUploaded={(att) => att.url && onSave(att.url)}
          />
        ) : (
          <div className="h-16 rounded-[var(--radius-home)] border border-dashed border-[var(--denoise-border)] flex items-center justify-center text-[10px] text-[var(--denoise-cream-muted)]">
            No logo
          </div>
        )}
      </div>
    </div>
  );
}

function SortableRow({
  item,
  index,
  canEdit,
  onEdit,
  onRemove,
}: {
  item: ShootDayItemRow;
  index: number;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
    position: "relative",
  };
  const KindIcon = kindIcon(item.kind);
  const kindLabel = item.kind.toUpperCase();
  const timeLabel = item.startTime
    ? `${item.startTime}${item.endTime ? " – " + item.endTime : ""}`
    : item.durationMinutes
      ? `${item.durationMinutes}m`
      : null;
  const isScene = item.kind === "scene" && item.scene;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-4 py-3 hover:bg-[var(--denoise-surface-2)] transition-colors",
        isDragging && "bg-[var(--denoise-surface-2)]",
        !isScene && "bg-[var(--denoise-bg)]/40",
      )}
    >
      <div className="flex items-center gap-3">
        {canEdit && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Reorder"
            className="text-[var(--denoise-cream-muted)] hover:text-[var(--denoise-copper)] cursor-grab touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--denoise-copper)] tabular-nums w-8">
          {String(index).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
            isScene
              ? "bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]"
              : "bg-white/[0.04] text-[var(--denoise-cream-muted)]",
          )}
        >
          <KindIcon className="h-3 w-3" />
        </span>
        {isScene && item.scene ? (
          <>
            <span className="text-[13px] font-medium text-[var(--denoise-cream)] tabular-nums w-14">
              #{item.scene.number}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[var(--denoise-cream)] truncate">
                {item.scene.title}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5 flex items-center gap-2">
                <span>
                  {item.scene.type} · {item.scene.timeOfDay}
                </span>
                {item.scene.location && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                      <MapPin className="h-2.5 w-2.5" />
                      {item.scene.location}
                    </span>
                  </>
                )}
                {item.scene.pagesCount && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{item.scene.pagesCount} pg</span>
                  </>
                )}
                {item.scene.estimatedMinutes ? (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-2.5 w-2.5" />
                      {item.scene.estimatedMinutes}m
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] tabular-nums text-right">
              <div>{item.scene.castCount} cast</div>
              <div>{item.scene.assetCount} assets</div>
            </div>
          </>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] w-14">
              {kindLabel}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[var(--denoise-cream)] truncate">
                {item.label ?? kindLabel}
              </p>
              {(timeLabel || item.notes) && (
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5">
                  {timeLabel}
                  {timeLabel && item.notes && <span className="opacity-40"> · </span>}
                  {item.notes}
                </p>
              )}
            </div>
          </>
        )}
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-7 text-[11px] px-2"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-7 w-7 text-[var(--denoise-cream-muted)] hover:text-red-300"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function kindIcon(kind: ShootDayItemRow["kind"]) {
  switch (kind) {
    case "scene":
      return Film;
    case "prep":
      return Hammer;
    case "break":
      return Coffee;
    case "move":
      return Truck;
    case "meal":
      return Utensils;
  }
}

// ── forms ───────────────────────────────────────────────────────────

function NonSceneItemForm({
  item,
  onDone,
}: {
  item: ShootDayItemRow;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(item.label ?? "");
  const [startTime, setStartTime] = useState(item.startTime ?? "");
  const [endTime, setEndTime] = useState(item.endTime ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    item.durationMinutes?.toString() ?? "",
  );
  const [notes, setNotes] = useState(item.notes ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await updateShootDayItemAction({
        itemId: item.id,
        patch: {
          label: label.trim() || null,
          startTime: startTime.trim() || null,
          endTime: endTime.trim() || null,
          durationMinutes: durationMinutes.trim() ? parseInt(durationMinutes, 10) : null,
          notes: notes.trim() || null,
        },
      });
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SheetHeader className="border-b border-[var(--denoise-border)]">
        <SheetTitle className="text-[var(--denoise-cream)]">Edit {item.kind}</SheetTitle>
      </SheetHeader>
      <div className="p-4 space-y-4">
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="1hr 30min Prep"
            className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
          </Field>
          <Field label="End">
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
            />
          </Field>
        </div>
        <Field label="Duration (minutes)">
          <Input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="30"
            className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="text-[12px] bg-[var(--denoise-bg)] border-[var(--denoise-border)] resize-none"
          />
        </Field>
        <div className="pt-3 border-t border-[var(--denoise-border)] flex justify-end gap-2">
          <Button variant="outline" onClick={onDone} className="h-9">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={pending}
            className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
          >
            Save
          </Button>
        </div>
      </div>
    </>
  );
}

function SceneMetaForm({
  scene,
  onDone,
}: {
  scene: NonNullable<ShootDayItemRow["scene"]>;
  onDone: () => void;
}) {
  const [minutes, setMinutes] = useState<string>(
    scene.estimatedMinutes?.toString() ?? "",
  );
  const [pages, setPages] = useState<string>(scene.pagesCount ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await updateSceneShootMetaAction({
        sceneId: scene.id,
        estimatedMinutes: minutes.trim() ? parseInt(minutes, 10) : null,
        pagesCount: pages.trim() || null,
      });
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SheetHeader className="border-b border-[var(--denoise-border)]">
        <SheetTitle className="text-[var(--denoise-cream)]">
          Scene #{scene.number} — Shoot Meta
        </SheetTitle>
      </SheetHeader>
      <div className="p-4 space-y-4">
        <Field label="Estimated Minutes">
          <Input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="e.g. 120"
            className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
          />
        </Field>
        <Field label='Pages Count (e.g. "2/8")'>
          <Input
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="2/8"
            className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
          />
        </Field>
        <div className="pt-3 border-t border-[var(--denoise-border)] flex justify-end gap-2">
          <Button variant="outline" onClick={onDone} className="h-9">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={pending}
            className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
          >
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
