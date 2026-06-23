"use client";

/**
 * V0.18 — Scene assets panel.
 *
 * Lives inside each enabled SceneDepartmentCard. Shows the list of
 * Equipment linked to this scene+dept, with shortage warnings, +
 * a picker dialog to add more from the dept's Resources.
 *
 * Department-aware labels: Art = "Props", Camera/Sound = "Equipment",
 * Casting = "Talent", everything else = "Assets".
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, Package, Search } from "lucide-react";

export interface SceneAssetEntry {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: string | null;
  inventoryQuantity: number;
  quantityNeeded: number;
  totalDemand: number;
  shortage: number;
  notes: string | null;
  addedBy: { id: string; name: string } | null;
}

export interface DeptEquipment {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
}

function labelForDept(kind: string): { singular: string; plural: string } {
  if (kind === "art") return { singular: "Prop", plural: "Props" };
  if (kind === "casting") return { singular: "Talent", plural: "Cast" };
  if (kind === "wardrobe")
    return { singular: "Wardrobe item", plural: "Wardrobe" };
  if (kind === "makeup")
    return { singular: "Makeup item", plural: "Makeup & SFX" };
  return { singular: "Asset", plural: "Equipment" };
}

export function SceneAssetsPanel({
  projectId,
  sceneId,
  departmentKind,
  canEdit,
  entries,
  catalog,
}: {
  projectId: string;
  sceneId: string;
  departmentKind: string;
  canEdit: boolean;
  entries: SceneAssetEntry[];
  /** Full equipment list for this dept (the picker source). */
  catalog: DeptEquipment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const label = labelForDept(departmentKind);

  const linkedIds = new Set(entries.map((e) => e.equipmentId));
  const availableCatalog = catalog.filter((c) => !linkedIds.has(c.id));

  function removeRow(id: string, name: string) {
    if (!confirm(`Remove ${name} from this scene?`)) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/assets/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Removed.");
      router.refresh();
    });
  }

  function updateQuantity(id: string, value: number) {
    if (value < 1) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/assets/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantityNeeded: value }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {label.plural} ({entries.length})
        </Label>
        {canEdit && catalog.length > 0 && (
          <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add {label.singular}
              </Button>
            </SheetTrigger>
            <AssetPickerDialog
              projectId={projectId}
              sceneId={sceneId}
              label={label}
              available={availableCatalog}
              onClose={() => setDialogOpen(false)}
            />
          </Sheet>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-md border border-dashed border-white/[0.06] bg-white/[0.02] px-3 py-3 text-center">
          {canEdit && catalog.length === 0
            ? `No ${label.plural.toLowerCase()} in the dept's Resources yet. Record a purchase or rental first.`
            : `No ${label.plural.toLowerCase()} linked to this scene yet.`}
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {e.equipmentName}
                  </div>
                  {e.equipmentCategory && (
                    <div className="text-[11px] text-muted-foreground">
                      {e.equipmentCategory}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">×</span>
                  {canEdit ? (
                    <Input
                      type="number"
                      min={1}
                      defaultValue={e.quantityNeeded}
                      className="h-7 w-14 text-xs text-center"
                      onBlur={(ev) => {
                        const v = parseInt(ev.target.value, 10);
                        if (!isNaN(v) && v !== e.quantityNeeded) {
                          updateQuantity(e.id, v);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-sm tabular-nums font-medium">
                      {e.quantityNeeded}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeRow(e.id, e.equipmentName)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  Inventory: {e.inventoryQuantity} · Total demand:{" "}
                  {e.totalDemand}
                </span>
                {e.shortage > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 bg-amber-500/10 border-amber-500/30 text-amber-300"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Short by {e.shortage}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetPickerDialog({
  projectId,
  sceneId,
  label,
  available,
  onClose,
}: {
  projectId: string;
  sceneId: string;
  label: { singular: string; plural: string };
  available: DeptEquipment[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filtered = query.trim()
    ? available.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : available;

  function add(equipmentId: string, name: string) {
    const q = quantities[equipmentId] ?? 1;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/assets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipmentId, quantityNeeded: q }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success(`Added ${name} (×${q}).`);
      router.refresh();
    });
  }

  return (
    <SheetContent className="w-full sm:max-w-md flex flex-col">
      <SheetHeader>
        <SheetTitle>Add {label.singular} to this scene</SheetTitle>
        <SheetDescription>
          Pick from this department&apos;s Resources (anything purchased
          or rented). Set the quantity needed for this scene.
        </SheetDescription>
      </SheetHeader>
      <div className="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${label.plural.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No matching {label.plural.toLowerCase()}.
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.category ? `${c.category} · ` : ""}
                    {c.quantity} in inventory
                  </div>
                </div>
                <Input
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="h-8 w-14 text-xs text-center"
                  onChange={(ev) => {
                    const v = parseInt(ev.target.value, 10);
                    setQuantities((prev) => ({
                      ...prev,
                      [c.id]: isNaN(v) ? 1 : v,
                    }));
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => add(c.id, c.name)}
                  disabled={pending}
                >
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
      <SheetFooter>
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
