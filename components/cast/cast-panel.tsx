"use client";

/**
 * V0.25 — Cast panel.
 *
 * List page for Talent (project-wide). Renders as cards with
 * headshot + character + scene count. Client roles see the same
 * cards MINUS contact/rate (server strips those fields before
 * they reach us).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
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
import {
  Plus,
  Users2,
  Trash2,
  Pencil,
  Phone,
  Mail,
  DollarSign,
} from "lucide-react";

interface Talent {
  id: string;
  name: string;
  characterName: string | null;
  bio: string | null;
  headshotUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  agentName: string | null;
  agentContact: string | null;
  dayRate: number | null;
  department: { id: string; name: string; kind: string };
  sceneCount: number;
}

interface DeptOption {
  id: string;
  name: string;
  kind: string;
}

export function CastPanel({
  projectId,
  canManage,
  currency,
  departments,
}: {
  projectId: string;
  canManage: boolean;
  currency: string;
  departments: DeptOption[];
}) {
  const router = useRouter();
  const [talents, setTalents] = useState<Talent[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch(`/api/projects/${projectId}/talents`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({ talents: [] }));
      if (!cancel) setTalents(data.talents ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/talents`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ talents: [] }));
    setTalents(data.talents ?? []);
    router.refresh();
  }

  const filtered = useMemo(() => {
    if (!talents) return [];
    const q = search.trim().toLowerCase();
    if (!q) return talents;
    return talents.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.characterName ?? "").toLowerCase().includes(q)
    );
  }, [talents, search]);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Cast</h2>
            <p className="text-sm text-muted-foreground">
              {talents?.length ?? 0}{" "}
              {talents?.length === 1 ? "actor" : "actors"} on this production.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search name or character…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64"
          />
          {canManage && (
            <NewTalentButton
              projectId={projectId}
              departments={departments}
              onDone={refresh}
            />
          )}
        </div>
      </div>

      {talents === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <Users2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {talents.length === 0
              ? "No talent yet. Add cast members to start linking them to scenes."
              : "No talent matches this search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <TalentCard
              key={t.id}
              projectId={projectId}
              talent={t}
              canManage={canManage}
              currency={currency}
              departments={departments}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TalentCard({
  projectId,
  talent,
  canManage,
  currency,
  departments,
  onChanged,
}: {
  projectId: string;
  talent: Talent;
  canManage: boolean;
  currency: string;
  departments: DeptOption[];
  onChanged: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function remove() {
    if (!confirm(`Remove ${talent.name} from Cast?`)) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/talents/${talent.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Removed.");
      onChanged();
    });
  }

  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
      <div className="aspect-[4/5] bg-gradient-to-b from-white/[0.02] to-black/40 relative">
        {talent.headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={talent.headshotUrl}
            alt={talent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl text-muted-foreground/30 font-semibold">
            {talent.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
        )}
        {canManage && (
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-black/60 backdrop-blur hover:bg-black/80"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-black/60 backdrop-blur hover:bg-red-500/80"
              onClick={remove}
              disabled={pending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="font-semibold text-sm">{talent.name}</div>
        {talent.characterName && (
          <div className="text-xs text-primary">
            as {talent.characterName}
          </div>
        )}
        {talent.bio && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {talent.bio}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
            {talent.sceneCount}{" "}
            {talent.sceneCount === 1 ? "scene" : "scenes"}
          </Badge>
          {talent.dayRate !== null && (
            <Badge
              variant="outline"
              className="text-[10px] bg-white/[0.04] gap-1"
            >
              <DollarSign className="h-2.5 w-2.5" />
              {(talent.dayRate / 100).toFixed(0)} {currency}/day
            </Badge>
          )}
        </div>
        {(talent.contactPhone || talent.contactEmail) && (
          <div className="pt-1 space-y-0.5">
            {talent.contactPhone && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Phone className="h-2.5 w-2.5" />
                {talent.contactPhone}
              </div>
            )}
            {talent.contactEmail && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Mail className="h-2.5 w-2.5" />
                {talent.contactEmail}
              </div>
            )}
          </div>
        )}
      </div>
      <TalentFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        existing={talent}
        departments={departments}
        currency={currency}
        onDone={onChanged}
      />
    </div>
  );
}

function NewTalentButton({
  projectId,
  departments,
  onDone,
}: {
  projectId: string;
  departments: DeptOption[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2 h-9">
          <Plus className="h-4 w-4" />
          Add talent
        </Button>
      </SheetTrigger>
      <TalentFormSheet
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        departments={departments}
        onDone={() => {
          setOpen(false);
          onDone();
        }}
      />
    </Sheet>
  );
}

function TalentFormSheet({
  open,
  onOpenChange,
  projectId,
  departments,
  existing,
  onDone,
  currency: _currency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  departments: DeptOption[];
  existing?: Talent;
  onDone: () => void;
  currency?: string;
}) {
  const [pending, startTransition] = useTransition();
  const castingDept =
    departments.find((d) => d.kind === "casting_director") ??
    departments.find((d) => d.kind === "casting_manager") ??
    departments[0];
  const [departmentId, setDepartmentId] = useState<string>(
    existing?.department.id ?? castingDept?.id ?? ""
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [characterName, setCharacterName] = useState(
    existing?.characterName ?? ""
  );
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [headshotUrl, setHeadshotUrl] = useState(existing?.headshotUrl ?? "");
  const [contactPhone, setContactPhone] = useState(
    existing?.contactPhone ?? ""
  );
  const [contactEmail, setContactEmail] = useState(
    existing?.contactEmail ?? ""
  );
  const [agentName, setAgentName] = useState(existing?.agentName ?? "");
  const [agentContact, setAgentContact] = useState(
    existing?.agentContact ?? ""
  );
  const [dayRate, setDayRate] = useState(
    existing?.dayRate !== null && existing?.dayRate !== undefined
      ? String(existing.dayRate / 100)
      : ""
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required.");
    if (!departmentId) return toast.error("Pick a department.");
    startTransition(async () => {
      const rate = dayRate.trim() === "" ? null : Math.round(Number(dayRate) * 100);
      if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
        toast.error("Day rate isn't a valid number.");
        return;
      }
      const payload = {
        departmentId,
        name: name.trim(),
        characterName: characterName.trim() || null,
        bio: bio.trim() || null,
        headshotUrl: headshotUrl.trim() || null,
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        agentName: agentName.trim() || null,
        agentContact: agentContact.trim() || null,
        dayRate: rate,
      };
      const res = await fetch(
        existing
          ? `/api/projects/${projectId}/talents/${existing.id}`
          : `/api/projects/${projectId}/talents`,
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success(existing ? "Updated." : "Added.");
      onDone();
    });
  }

  return (
    <SheetContent className="w-full sm:max-w-md flex flex-col">
      <form onSubmit={submit} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>
            {existing ? `Edit ${existing.name}` : "Add talent"}
          </SheetTitle>
          <SheetDescription>
            Business info (contact, rate) is hidden from agency roles.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!existing && (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Character</Label>
            <Input
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="e.g. Detective Al-Amin"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>
          <div className="space-y-2">
            <Label>Headshot URL</Label>
            <Input
              type="url"
              value={headshotUrl}
              onChange={(e) => setHeadshotUrl(e.target.value)}
              placeholder="https://…"
              maxLength={800}
            />
          </div>
          <div className="border-t border-white/[0.04] pt-3 mt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Business info (hidden from agency)
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    maxLength={60}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    maxLength={200}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Agent name</Label>
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    maxLength={200}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Agent contact</Label>
                  <Input
                    value={agentContact}
                    onChange={(e) => setAgentContact(e.target.value)}
                    maxLength={200}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Day rate</Label>
                <Input
                  inputMode="decimal"
                  value={dayRate}
                  onChange={(e) => setDayRate(e.target.value)}
                  placeholder="1500"
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : existing ? "Save" : "Add talent"}
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
