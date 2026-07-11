"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserPlus,
  Trash2,
  Crown,
  Mail,
  Clock,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { GroupedRolePicker } from "@/components/shared/grouped-role-picker";
import { AddPersonaButton } from "./add-persona-button";
// `ROLES` is still used by the per-member role select on the panel above.
void ROLES;

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  isOwner: boolean;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface DepartmentGroup {
  key: string;
  label: string;
  headRole: string;
  members: MemberRow[];
}

interface MembersPanelProps {
  projectId: string;
  /** Owner only (still surfaced for the Owner badge). */
  isOwner: boolean;
  /**
   * V0.12.1 — true when the caller has any role they're allowed to
   * invite (Owner / EP / Producer / Director / resolved dept head).
   * Computed server-side in the page from `invitableRoles().length > 0`.
   */
  canInvite: boolean;
  /**
   * V0.12.1 — true when the caller may change other members' roles or
   * remove them (Owner / EP / Producer). Different from canInvite —
   * dept heads can invite but cannot manage existing members at the
   * project level.
   */
  canManageMembers: boolean;
  members: MemberRow[];
  invitations: InvitationRow[];
  /** V0.10.1 — members grouped by registry department. */
  departmentGroups?: DepartmentGroup[];
}

export function MembersPanel({
  projectId,
  isOwner,
  canInvite,
  canManageMembers,
  members,
  invitations,
  departmentGroups,
}: MembersPanelProps) {
  void isOwner;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "person" : "people"} on this production.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canInvite &&
            process.env.NEXT_PUBLIC_QUICK_LOGIN === "1" && (
              <AddPersonaButton projectId={projectId} />
            )}
          {canInvite && <InviteMemberButton projectId={projectId} />}
        </div>
      </div>

      {/* V0.10.1 — registry-driven department grouping (when provided). */}
      {departmentGroups && departmentGroups.length > 0 ? (
        <div className="space-y-4">
          {departmentGroups.map((g) => {
            const head = g.members.find(
              (m) => m.role === g.headRole && !m.isOwner
            );
            const others = g.members.filter((m) => m !== head);
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {g.label}
                  </h3>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {g.members.length}{" "}
                    {g.members.length === 1 ? "person" : "people"}
                  </span>
                </div>
                <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft divide-y divide-white/[0.04]">
                  {head && (
                    <MemberRowItem
                      projectId={projectId}
                      member={head}
                      canManage={canManageMembers}
                    />
                  )}
                  {others.map((m) => (
                    <MemberRowItem
                      key={m.id}
                      projectId={projectId}
                      member={m}
                      canManage={canManageMembers}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft divide-y divide-white/[0.04]">
          {members.map((m) => (
            <MemberRowItem
              key={m.id}
              projectId={projectId}
              member={m}
              canManage={canManageMembers}
            />
          ))}
        </div>
      )}

      {invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending invitations
          </h3>
          <div className="rounded-2xl bg-card/40 border border-white/[0.04] divide-y divide-white/[0.04]">
            {invitations.map((inv) => (
              <InvitationRowItem
                key={inv.id}
                projectId={projectId}
                invitation={inv}
                canManage={canManageMembers}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRowItem({
  projectId,
  member,
  canManage,
}: {
  projectId: string;
  member: MemberRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(member.role);

  const joined = new Date(member.joinedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const initials = member.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function changeRole(next: string) {
    setRole(next);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update role.");
        setRole(member.role);
        return;
      }
      toast.success("Role updated.");
      router.refresh();
    });
  }

  async function remove() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to remove member.");
        return;
      }
      toast.success(`${member.name} removed.`);
      router.refresh();
    });
  }

  const canEditThisRow = canManage && !member.isOwner;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-sm font-medium">
        {initials || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{member.name}</span>
          {member.isOwner && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 text-primary"
            >
              <Crown className="h-3 w-3" />
              Owner
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {member.email} · joined {joined}
        </div>
      </div>

      {canEditThisRow ? (
        <Select value={role} onValueChange={changeRole} disabled={pending}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge
          variant="outline"
          className="border-white/[0.08] bg-white/[0.03] text-foreground/85"
        >
          {ROLE_LABELS[role] ?? role}
        </Badge>
      )}

      {canEditThisRow && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              aria-label="Remove member"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They will lose access to this project. Any tasks assigned to
                them will become unassigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function InvitationRowItem({
  projectId,
  invitation,
  canManage,
}: {
  projectId: string;
  invitation: InvitationRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function revoke() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/invitations/${invitation.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Failed to revoke invitation.");
        return;
      }
      toast.success("Invitation revoked.");
      router.refresh();
    });
  }

  const expires = new Date(invitation.expiresAt);
  const expired = expires.getTime() < Date.now();

  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="h-9 w-9 rounded-full bg-muted/50 border border-white/[0.05] flex items-center justify-center text-muted-foreground">
        <Mail className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{invitation.email}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {expired ? "Expired" : `Expires ${expires.toLocaleDateString()}`}
          <span>·</span>
          <span>invited by {invitation.invitedBy}</span>
        </div>
      </div>
      <Badge
        variant="outline"
        className={
          expired
            ? "border-red-400/25 bg-red-400/10 text-red-300"
            : "border-amber-400/25 bg-amber-400/10 text-amber-200"
        }
      >
        {expired ? "Expired" : "Pending"}
      </Badge>
      <Badge
        variant="outline"
        className="border-white/[0.08] bg-white/[0.03] text-foreground/85"
      >
        {ROLE_LABELS[invitation.role] ?? invitation.role}
      </Badge>
      {canManage && (
        <Button
          variant="ghost"
          size="icon"
          onClick={revoke}
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Revoke invitation"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function InviteMemberButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [allowedRoles, setAllowedRoles] = useState<
    { value: string; label: string }[]
  >([]);
  const [role, setRole] = useState<string>("");
  const [pending, startTransition] = useTransition();

  // V0.5 — only show roles the current caller is allowed to invite, per
  // the hierarchy registry. Server enforces the same rule on POST.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/invitable-roles`)
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => {
        if (cancelled) return;
        const list: { value: string; label: string }[] = data.roles ?? [];
        setAllowedRoles(list);
        setRole(list[0]?.value ?? "");
      })
      .catch(() => {
        if (!cancelled) setAllowedRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send invitation.");
        return;
      }
      toast.success(
        data.matchedExistingUser
          ? "Invitation sent. They can accept from their Invitations page."
          : "Invitation saved. It'll appear when they register with this email."
      );
      setEmail("");
      setRole(allowedRoles[0]?.value ?? "");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite member
        </Button>
      </SheetTrigger>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Invite a member</SheetTitle>
            <SheetDescription>
              They&apos;ll be able to see and contribute to this project once
              they accept.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role on this project</Label>
              {allowedRoles.length === 0 ? (
                <div className="text-xs text-muted-foreground rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                  Your role can&apos;t invite anyone on this project.
                </div>
              ) : (
                <GroupedRolePicker
                  value={role}
                  onChange={setRole}
                  availableRoles={allowedRoles.map((r) => r.value)}
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Roles you&apos;re allowed to invite per the project hierarchy.
              </p>
            </div>
          </div>

          <SheetFooter>
            <Button
              type="submit"
              disabled={pending || !email || !role || allowedRoles.length === 0}
            >
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
