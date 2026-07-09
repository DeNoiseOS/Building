"use client";

/**
 * V0.25 — Cast panel on a scene detail page.
 *
 * Mirrors SceneAssetsPanel: lists linked talents, lets manageable
 * users pick from the project-wide Cast list. Shows headshot +
 * character (from the scene link, falling back to the talent's
 * default character).
 */

import { useEffect, useState, useTransition } from "react";
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
import {
  Users2,
  Plus,
  Trash2,
  Search,
} from "lucide-react";

interface SceneCastRow {
  id: string;
  characterName: string | null;
  callTime: string | null;
  talent: {
    id: string;
    name: string;
    characterName: string | null;
    headshotUrl: string | null;
  };
}

interface CatalogTalent {
  id: string;
  name: string;
  characterName: string | null;
  headshotUrl: string | null;
}

export function SceneCastPanel({
  projectId,
  sceneId,
  canManage,
}: {
  projectId: string;
  sceneId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [cast, setCast] = useState<SceneCastRow[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogTalent[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function loadCast() {
    const res = await fetch(
      `/api/projects/${projectId}/scenes/${sceneId}/cast`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({ cast: [] }));
    setCast(data.cast ?? []);
  }
  async function loadCatalog() {
    const res = await fetch(`/api/projects/${projectId}/talents`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ talents: [] }));
    setCatalog(data.talents ?? []);
  }

  useEffect(() => {
    loadCast();
    if (canManage) loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sceneId, canManage]);

  function remove(id: string, name: string) {
    if (!confirm(`Remove ${name} from this scene?`)) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/cast/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      loadCast();
      router.refresh();
    });
  }

  const linkedIds = new Set(cast?.map((c) => c.talent.id) ?? []);
  const available =
    catalog?.filter((c) => !linkedIds.has(c.id)) ?? [];

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Cast</h2>
          <span className="text-xs text-muted-foreground">
            {cast?.length ?? 0}
          </span>
        </div>
        {canManage && catalog && catalog.length > 0 && (
          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" />
                Cast someone
              </Button>
            </SheetTrigger>
            <PickerSheet
              projectId={projectId}
              sceneId={sceneId}
              available={available}
              onDone={() => {
                setAddOpen(false);
                loadCast();
                router.refresh();
              }}
            />
          </Sheet>
        )}
      </div>
      <div className="p-5">
        {cast === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : cast.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No cast linked to this scene yet.
            {canManage && catalog?.length === 0 && (
              <> Add talent from the Cast tab first.</>
            )}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {cast.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-3"
              >
                <div className="h-12 w-12 rounded-full bg-black/40 overflow-hidden shrink-0">
                  {c.talent.headshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.talent.headshotUrl}
                      alt={c.talent.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground font-semibold">
                      {c.talent.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.talent.name}
                  </div>
                  {c.characterName && (
                    <div className="text-[11px] text-primary truncate">
                      as {c.characterName}
                    </div>
                  )}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => remove(c.id, c.talent.name)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PickerSheet({
  projectId,
  sceneId,
  available,
  onDone,
}: {
  projectId: string;
  sceneId: string;
  available: CatalogTalent[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [charOverrides, setCharOverrides] = useState<
    Record<string, string>
  >({});

  const filtered = query.trim()
    ? available.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : available;

  function add(talentId: string, name: string) {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/cast`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            talentId,
            characterName: charOverrides[talentId]?.trim() || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success(`Cast ${name}.`);
    });
  }

  return (
    <SheetContent className="w-full sm:max-w-md flex flex-col">
      <SheetHeader>
        <SheetTitle>Cast talent in this scene</SheetTitle>
        <SheetDescription>
          Pick from project-wide Cast. Override the character name if
          this scene calls for it.
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cast…"
            className="pl-9"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No available cast.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 flex items-center gap-2"
              >
                <div className="h-9 w-9 rounded-full bg-black/40 overflow-hidden shrink-0">
                  {t.headshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.headshotUrl}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      {t.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <Input
                    value={charOverrides[t.id] ?? ""}
                    onChange={(e) =>
                      setCharOverrides((c) => ({
                        ...c,
                        [t.id]: e.target.value,
                      }))
                    }
                    placeholder={t.characterName ?? "Character in scene"}
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => add(t.id, t.name)}
                  disabled={pending}
                >
                  Cast
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <SheetFooter>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
