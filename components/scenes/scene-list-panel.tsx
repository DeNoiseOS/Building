"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import {
  SCENE_TYPES,
  SCENE_TIME_OF_DAY,
  SCENE_STATUS,
} from "@/lib/scene-data";
import { SceneStatusBadge } from "./scene-status-badge";

export interface SceneRow {
  id: string;
  number: string;
  title: string;
  location: string | null;
  type: string;
  timeOfDay: string;
  status: string;
}

/**
 * V0.17 — Scenes list with search / filter / sort.
 *
 * Sorting + search happen client-side over the props the server
 * delivered (project pages are bounded). Filtering also client-side
 * for instant feedback.
 */
export function SceneListPanel({
  projectId,
  scenes,
  canManage,
}: {
  projectId: string;
  scenes: SceneRow[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("number");

  const filtered = useMemo(() => {
    let rows = [...scenes];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.number.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          (s.location ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") rows = rows.filter((s) => s.status === statusFilter);
    if (typeFilter !== "all") rows = rows.filter((s) => s.type === typeFilter);
    if (timeFilter !== "all") rows = rows.filter((s) => s.timeOfDay === timeFilter);
    rows.sort((a, b) => {
      if (sort === "status") return a.status.localeCompare(b.status);
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
    return rows;
  }, [scenes, search, statusFilter, typeFilter, timeFilter, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Scenes</h2>
          <p className="text-sm text-muted-foreground">
            {scenes.length}{" "}
            {scenes.length === 1 ? "scene" : "scenes"} on this production.
          </p>
        </div>
        {canManage && <NewSceneButton projectId={projectId} />}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scene number, title, or location…"
            className="h-9 pl-9"
          />
        </div>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} label="All statuses" options={SCENE_STATUS} />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} label="All types" options={SCENE_TYPES} />
        <FilterSelect value={timeFilter} onChange={setTimeFilter} label="All times" options={SCENE_TIME_OF_DAY} />
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">By number</SelectItem>
            <SelectItem value="status">By status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {scenes.length === 0
              ? "No scenes yet. Create the first one to start planning."
              : "No scenes match the current filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              <tr className="border-b border-white/[0.04]">
                <th className="px-5 py-3 text-left font-medium">#</th>
                <th className="px-5 py-3 text-left font-medium">Title</th>
                <th className="px-5 py-3 text-left font-medium">Location</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-left font-medium">Time</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3 font-medium tabular-nums">
                    <Link
                      href={`/projects/${projectId}/scenes/${s.id}`}
                      className="hover:text-primary"
                    >
                      {s.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/projects/${projectId}/scenes/${s.id}`}
                      className="hover:text-primary"
                    >
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {s.location ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
                      {s.type.replace("_", "/")}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground capitalize">
                    {s.timeOfDay}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <SceneStatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NewSceneButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<string>("INT");
  const [timeOfDay, setTimeOfDay] = useState<string>("day");
  const [description, setDescription] = useState("");

  function reset() {
    setNumber("");
    setTitle("");
    setLocation("");
    setType("INT");
    setTimeOfDay("day");
    setDescription("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim() || !title.trim()) {
      return toast.error("Scene number and title are required.");
    }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: number.trim(),
          title: title.trim(),
          location: location.trim() || null,
          type,
          timeOfDay,
          description: description.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create scene.");
        return;
      }
      toast.success("Scene created.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New scene
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>New scene</SheetTitle>
            <SheetDescription>
              Scenes live under a project. You can toggle departments on
              after creation.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sc-num">Number</Label>
                <Input
                  id="sc-num"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="1"
                  required
                  maxLength={20}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="sc-title">Title</Label>
                <Input
                  id="sc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-loc">Location</Label>
              <Input
                id="sc-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time of day</Label>
                <Select value={timeOfDay} onValueChange={setTimeOfDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENE_TIME_OF_DAY.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-desc">Description</Label>
              <Textarea
                id="sc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create scene"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
