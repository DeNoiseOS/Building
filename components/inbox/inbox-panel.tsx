"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";

interface InvitationItem {
  id: string;
  project: { id: string; name: string; role: string };
  role: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export function InboxPanel({ invitations }: { invitations: InvitationItem[] }) {
  if (invitations.length === 0) {
    return (
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-10 text-center">
        <div className="mx-auto h-10 w-10 rounded-xl bg-muted/40 border border-white/[0.05] flex items-center justify-center text-muted-foreground">
          <Mail className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-sm font-medium">No pending invitations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          When someone invites you to a project, it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft divide-y divide-white/[0.04]">
      {invitations.map((inv) => (
        <InvitationCard key={inv.id} invitation={inv} />
      ))}
    </div>
  );
}

function InvitationCard({ invitation }: { invitation: InvitationItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function respond(action: "accept" | "decline") {
    startTransition(async () => {
      const res = await fetch(`/api/invitations/${invitation.id}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to respond to invitation.");
        return;
      }
      if (action === "accept") {
        toast.success(`You joined ${invitation.project.name}.`);
        router.push(`/projects/${invitation.project.id}`);
      } else {
        toast.success("Invitation declined.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
        <Mail className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{invitation.project.name}</span>
          <Badge variant="secondary">
            {ROLE_LABELS[invitation.role] ?? invitation.role}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Invited by {invitation.invitedBy} ·{" "}
          {new Date(invitation.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => respond("decline")}
          disabled={pending}
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Decline
        </Button>
        <Button
          size="sm"
          onClick={() => respond("accept")}
          disabled={pending}
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
      </div>
    </div>
  );
}
