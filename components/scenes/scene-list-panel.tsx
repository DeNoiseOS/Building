"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  LayoutGrid,
  Rows3,
  MoreHorizontal,
  Pencil,
  Trash2,
  Film,
} from "lucide-react";
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
  /** V0.19 */
  coverImageUrl: string | null;
  enabledDepartments: number;
  approvedDepartments: number;
}

type ViewMode = "list" | "gallery";
const VIEW_STORAGE_KEY = "scenes.viewMode";

/** Gradient palette keyed by scene status — used for Gallery placeholder. */
const STATUS_GRADIENT: Record<string, string> = {
  draft:
    "bg-[linear-gradient(135deg,#1f2937_0%,#0f172a_100%)] text-white/40",
  planning:
    "bg-[linear-gradient(135deg,#92400e_0%,#451a03_100%)] text-amber-200/80",
  ready:
    "bg-[linear-gradient(135deg,#047857_0%,#022c22_100%)] text-emerald-200/80",
  scheduled:
    "bg-[linear-gradient(135deg,#6d28d9_0%,#1e1b4b_100%)] text-violet-200/80",
  shot:
    "bg-[linear-gradient(135deg,#7c2d12_0%,#1c1917_100%)] text-orange-200/80",
  completed:
    "bg-[linear-gradient(135deg,#065f46_0%,#022c22_100%)] text-emerald-100/80",
};

/**
 * V0.17/V0.19 — Scenes list with search / filter / sort, List + Gallery
 * views, dept-progress column, and a row-level overflow menu.
 *
 * View choice persists to localStorage so the user gets the same
 * layout when they come back.
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
  const [view, setView] = useState<ViewMode>("list");

  // Restore view mode from localStorage on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "gallery" || saved === "list") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);
  function chooseView(v: ViewMode) {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  }

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
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={chooseView} />
          {canManage && <NewSceneButton projectId={projectId} />}
        </div>
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
      ) : view === "list" ? (
        <SceneTable
          projectId={projectId}
          rows={filtered}
          canManage={canManage}
        />
      ) : (
        <SceneGallery
          projectId={projectId}
          rows={filtered}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
      <button
        type="button"
        className={`inline-flex items-center gap-1 px-2.5 h-8 text-xs rounded-[5px] transition-colors ${
          view === "list"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onChange("list")}
      >
        <Rows3 className="h-3.5 w-3.5" />
        List
      </button>
      <button
        type="button"
        className={`inline-flex items-center gap-1 px-2.5 h-8 text-xs rounded-[5px] transition-colors ${
          view === "gallery"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onChange("gallery")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Gallery
      </button>
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

/* -------------------- LIST view -------------------- */

function SceneTable({
  projectId,
  rows,
  canManage,
}: {
  projectId: string;
  rows: SceneRow[];
  canManage: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
          <tr className="border-b border-white/[0.04]">
            <th className="px-5 py-3 text-left font-medium">#</th>
            <th className="px-5 py-3 text-left font-medium">Title</th>
            <th className="px-5 py-3 text-left font-medium">Location</th>
            <th className="px-5 py-3 text-left font-medium">Type</th>
            <th className="px-5 py-3 text-left font-medium">Time</th>
            <th className="px-5 py-3 text-left font-medium">Status</th>
            <th className="px-5 py-3 text-left font-medium">Depts</th>
            <th className="px-5 py-3 text-left font-medium">Progress</th>
            <th className="px-5 py-3 text-right font-medium w-12"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <SceneTableRow
              key={s.id}
              projectId={projectId}
              row={s}
              canManage={canManage}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SceneTableRow({
  projectId,
  row,
  canManage,
}: {
  projectId: string;
  row: SceneRow;
  canManage: boolean;
}) {
  const pct =
    row.enabledDepartments === 0
      ? null
      : Math.round((row.approvedDepartments / row.enabledDepartments) * 100);
  return (
    <tr className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
      <td className="px-5 py-3 font-medium tabular-nums">
        <Link
          href={`/projects/${projectId}/scenes/${row.id}`}
          className="hover:text-primary"
        >
          {row.number}
        </Link>
      </td>
      <td className="px-5 py-3">
        <Link
          href={`/projects/${projectId}/scenes/${row.id}`}
          className="hover:text-primary"
        >
          {row.title}
        </Link>
      </td>
      <td className="px-5 py-3 text-muted-foreground">
        {row.location ?? "—"}
      </td>
      <td className="px-5 py-3">
        <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
          {row.type.replace("_", "/")}
        </Badge>
      </td>
      <td className="px-5 py-3 text-muted-foreground capitalize">
        {row.timeOfDay}
      </td>
      <td className="px-5 py-3">
        <SceneStatusBadge status={row.status} />
      </td>
      <td className="px-5 py-3 text-muted-foreground tabular-nums">
        {row.enabledDepartments === 0 ? (
          "—"
        ) : (
          <span>
            {row.enabledDepartments}{" "}
            <span className="text-muted-foreground/60">active</span>
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        {pct === null ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-16 text-right">
              {row.approvedDepartments}/{row.enabledDepartments} ·{" "}
              {pct}%
            </span>
          </div>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {canManage && <SceneRowMenu projectId={projectId} row={row} />}
      </td>
    </tr>
  );
}

/* -------------------- GALLERY view -------------------- */

function SceneGallery({
  projectId,
  rows,
  canManage,
}: {
  projectId: string;
  rows: SceneRow[];
  canManage: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rows.map((s) => (
        <SceneGalleryCard
          key={s.id}
          projectId={projectId}
          row={s}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function SceneGalleryCard({
  projectId,
  row,
  canManage,
}: {
  projectId: string;
  row: SceneRow;
  canManage: boolean;
}) {
  const pct =
    row.enabledDepartments === 0
      ? null
      : Math.round((row.approvedDepartments / row.enabledDepartments) * 100);
  const gradient = STATUS_GRADIENT[row.status] ?? STATUS_GRADIENT.draft;

  return (
    <div className="group rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden flex flex-col">
      <Link
        href={`/projects/${projectId}/scenes/${row.id}`}
        className="block relative aspect-video overflow-hidden"
      >
        {row.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.coverImageUrl}
            alt={row.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${gradient}`}
          >
            <Film className="h-12 w-12" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="bg-black/60 backdrop-blur border-white/10 text-white text-[10px] tabular-nums"
          >
            #{row.number}
          </Badge>
          <SceneStatusBadge status={row.status} />
        </div>
        {canManage && (
          <div
            className="absolute top-2 right-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <SceneRowMenu projectId={projectId} row={row} dark />
          </div>
        )}
      </Link>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <Link
          href={`/projects/${projectId}/scenes/${row.id}`}
          className="font-semibold leading-tight hover:text-primary"
        >
          {row.title}
        </Link>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
            {row.type.replace("_", "/")}
          </Badge>
          <span className="capitalize">{row.timeOfDay}</span>
          {row.location && (
            <>
              <span>·</span>
              <span className="truncate">{row.location}</span>
            </>
          )}
        </div>
        <div className="mt-auto pt-2">
          {pct === null ? (
            <div className="text-[11px] text-muted-foreground">
              No departments active
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>
                  {row.approvedDepartments}/{row.enabledDepartments}{" "}
                  approved
                </span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Row menu (Edit / Delete / Status) -------------------- */

function SceneRowMenu({
  projectId,
  row,
  dark = false,
}: {
  projectId: string;
  row: SceneRow;
  dark?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function changeStatus(next: string) {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/scenes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update status.");
        return;
      }
      toast.success("Status updated.");
      router.refresh();
    });
  }
  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/scenes/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete.");
        return;
      }
      toast.success("Scene deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={
              dark
                ? "h-7 w-7 bg-black/60 backdrop-blur hover:bg-black/80 text-white"
                : "h-7 w-7"
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit scene
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Change status
          </div>
          {SCENE_STATUS.map((s) => (
            <DropdownMenuItem
              key={s.value}
              disabled={s.value === row.status || pending}
              onClick={() => changeStatus(s.value)}
            >
              {s.label}
              {s.value === row.status && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  current
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete scene
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RowEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        row={row}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete scene #{row.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the scene and every department workspace
              under it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Lightweight inline edit sheet. Covers number, title, location, type,
 * time, status, and cover image URL. Heavy fields (description, notes,
 * attachments) live on the scene detail page so this stays quick.
 */
function RowEditSheet({
  open,
  onOpenChange,
  projectId,
  row,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  row: SceneRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState(row.number);
  const [title, setTitle] = useState(row.title);
  const [location, setLocation] = useState(row.location ?? "");
  const [type, setType] = useState(row.type);
  const [timeOfDay, setTimeOfDay] = useState(row.timeOfDay);
  const [status, setStatus] = useState(row.status);
  const [coverImageUrl, setCoverImageUrl] = useState(row.coverImageUrl ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim() || !title.trim()) {
      return toast.error("Number and title are required.");
    }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/scenes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: number.trim(),
          title: title.trim(),
          location: location.trim() || null,
          type,
          timeOfDay,
          status,
          coverImageUrl: coverImageUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Scene updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Edit scene #{row.number}</SheetTitle>
            <SheetDescription>
              Quick edit. For description, notes, and attachments, open
              the scene.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Number</Label>
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <Label>Time</Label>
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENE_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gallery thumbnail</Label>
              <Input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://… (image URL)"
                maxLength={800}
              />
              {coverImageUrl && (
                <div className="rounded-md overflow-hidden border border-white/[0.06] aspect-video bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Only Director / AD can set this.
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------- New scene -------------------- */

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
