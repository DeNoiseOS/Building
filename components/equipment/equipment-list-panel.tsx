"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUS_LABELS,
} from "@/lib/equipment-status";

interface Department {
  id: string;
  name: string;
}

interface EquipmentRow {
  id: string;
  name: string;
  serialNumber: string | null;
  category: string | null;
  status: string;
  department: { id: string; name: string; kind: string };
  currentHolder: { id: string; name: string } | null;
  openDamageCount: number;
  // V0.21.1
  /** "purchase" | "rental" | null (legacy rows have no source Purchase). */
  acquisitionType: string | null;
  /** Total inventory count for this line. */
  quantity: number;
  /** Currently checked-out count (open assignments). */
  used: number;
}

interface Totals {
  total: number;
  available: number;
  checkedOut: number;
  damaged: number;
  lost: number;
}

interface Props {
  projectId: string;
  totals: Totals;
  canManageAny: boolean;
  manageableDepartmentIds: string[];
  departments: Department[];
  equipment: EquipmentRow[];
  filter: { status: string; department: string };
  /** V0.10.1 — registry-driven label (e.g. "Props", "Equipment", "Talent"). */
  resourceLabel?: string;
}

const STATUS_PILL: Record<string, string> = {
  available: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  checked_out: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  returned: "border-white/[0.08] bg-white/[0.04] text-foreground/80",
  damaged: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  lost: "border-red-400/25 bg-red-400/10 text-red-300",
};

export function EquipmentListPanel({
  projectId,
  totals,
  canManageAny,
  manageableDepartmentIds,
  departments,
  equipment,
  filter,
  resourceLabel = "Equipment",
}: Props) {
  void canManageAny;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const creatableDepts = departments.filter((d) =>
    manageableDepartmentIds.includes(d.id)
  );

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{resourceLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Department resources — track checkout, return, and condition.
            </p>
          </div>
        </div>
        {creatableDepts.length > 0 && (
          <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add {resourceLabel.toLowerCase().replace(/s$/, "")}
          </Button>
        )}
      </div>

      {/* Project totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Total" value={totals.total} />
        <Metric
          label="Available"
          value={totals.available}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        />
        <Metric
          label="Checked out"
          value={totals.checkedOut}
          icon={<CornerDownLeft className="h-3.5 w-3.5 text-sky-400" />}
        />
        <Metric
          label="Damaged"
          value={totals.damaged}
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
        />
        <Metric
          label="Lost"
          value={totals.lost}
          icon={<XCircle className="h-3.5 w-3.5 text-red-400" />}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={filter.status || "all"}
          onValueChange={(v) => setQueryParam("status", v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EQUIPMENT_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filter.department || "all"}
          onValueChange={(v) =>
            setQueryParam("department", v === "all" ? "" : v)
          }
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        {equipment.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground text-center">
            No equipment matches these filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              <tr className="border-b border-white/[0.04]">
                <Th>Item</Th>
                <Th>Type</Th>
                <Th>Department</Th>
                <Th>Quantity</Th>
                <Th>Status</Th>
                <Th>Holder</Th>
                <Th align="right">Damage</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/projects/${projectId}/equipment/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.name}
                    </Link>
                    {e.serialNumber && (
                      <p className="text-[11px] text-muted-foreground">
                        SN {e.serialNumber}
                      </p>
                    )}
                    {e.category && (
                      <p className="text-[11px] text-muted-foreground">
                        {e.category}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {e.acquisitionType === "purchase" ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300 text-[10px]"
                      >
                        Purchase
                      </Badge>
                    ) : e.acquisitionType === "rental" ? (
                      <Badge
                        variant="outline"
                        className="border-sky-400/25 bg-sky-400/10 text-sky-300 text-[10px]"
                      >
                        Rental
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{e.department.name}</td>
                  <td className="px-3 py-3 tabular-nums">
                    <div className="text-sm">
                      <span className="font-medium">
                        {Math.max(0, e.quantity - e.used)}
                      </span>
                      <span className="text-muted-foreground"> / {e.quantity}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {e.used > 0
                        ? `${e.used} in use`
                        : "all available"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={STATUS_PILL[e.status]}>
                      {EQUIPMENT_STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {e.currentHolder?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {e.openDamageCount > 0 ? (
                      <span className="text-amber-300 font-medium">
                        {e.openDamageCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/projects/${projectId}/equipment/${e.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {createOpen && (
        <CreateEquipmentSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          departments={creatableDepts}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight mt-1">
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-semibold",
        align === "right" && "text-right"
      )}
    >
      {children}
    </th>
  );
}

function CreateEquipmentSheet({
  open,
  onOpenChange,
  projectId,
  departments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  departments: Department[];
}) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!departmentId || !name.trim()) {
      toast.error("Department and name are required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          name: name.trim(),
          serialNumber: serialNumber.trim() || null,
          category: category.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add.");
        return;
      }
      toast.success("Added.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>New equipment</SheetTitle>
            <SheetDescription>
              Tracked under one department. Status defaults to Available.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="eq-dept">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="eq-dept">
                  <SelectValue placeholder="Choose a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-name">Name</Label>
              <Input
                id="eq-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sony FX6"
                required
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="eq-sn">Serial number</Label>
                <Input
                  id="eq-sn"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-cat">Category</Label>
                <Input
                  id="eq-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Camera"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-notes">Notes</Label>
              <Textarea
                id="eq-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
