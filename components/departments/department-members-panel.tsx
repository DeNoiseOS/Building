"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Trash2, Crown, Users as UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";

export interface DeptMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface Addable {
  id: string;
  name: string;
  email: string;
}

interface Props {
  projectId: string;
  departmentId: string;
  isOwner: boolean;
  members: DeptMember[];
  addableMembers: Addable[];
}

export function DepartmentMembersPanel({
  projectId,
  departmentId,
  isOwner,
  members,
  addableMembers,
}: Props) {
  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          Members
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            ({members.length})
          </span>
        </h2>
        {isOwner && (
          <AddMemberSheet
            projectId={projectId}
            departmentId={departmentId}
            addable={addableMembers}
          />
        )}
      </div>
      <div className="divide-y divide-white/[0.04]">
        {members.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No one is assigned to this department yet.
          </div>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.id}
              projectId={projectId}
              departmentId={departmentId}
              member={m}
              isOwner={isOwner}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MemberRow({
  projectId,
  departmentId,
  member,
  isOwner,
}: {
  projectId: string;
  departmentId: string;
  member: DeptMember;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initials = member.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function remove() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/departments/${departmentId}/members/${member.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to remove member.");
        return;
      }
      toast.success(`${member.name} removed from department.`);
      router.refresh();
    });
  }

  const isLead = member.role === "lead";

  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-xs font-medium">
        {initials || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{member.name}</span>
          {isLead && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 text-primary"
            >
              <Crown className="h-3 w-3" />
              Lead
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {member.email} · joined{" "}
          {new Date(member.joinedAt).toLocaleDateString()}
        </div>
      </div>
      {isOwner && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              aria-label="Remove from department"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remove {member.name} from this department?
              </AlertDialogTitle>
              <AlertDialogDescription>
                They&apos;ll stay on the project but lose this department
                membership.
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

function AddMemberSheet({
  projectId,
  departmentId,
  addable,
}: {
  projectId: string;
  departmentId: string;
  addable: Addable[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>(addable[0]?.id ?? "");
  const [role, setRole] = useState<string>("member");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      toast.error("Pick a project member to add.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/departments/${departmentId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add member.");
        return;
      }
      toast.success(`${data.name} added.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5" disabled={addable.length === 0}>
          <UserPlus className="h-3.5 w-3.5" />
          Add member
        </Button>
      </SheetTrigger>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Add to department</SheetTitle>
            <SheetDescription>
              Only existing project members can be added. To bring in someone
              new, invite them on the Members tab first.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-add-user">Project member</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="dept-add-user">
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {addable.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-add-role">Role in department</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="dept-add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending || !userId}>
              {pending ? "Adding…" : "Add to department"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
