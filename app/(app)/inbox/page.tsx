import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InboxPanel } from "@/components/inbox/inbox-panel";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  const pending = me
    ? await prisma.projectInvitation.findMany({
        where: { email: me.email, status: "pending" },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, role: true } },
          inviter: { select: { name: true } },
        },
      })
    : [];

  const invitations = pending.map((i) => ({
    id: i.id,
    project: i.project,
    role: i.role,
    invitedBy: i.inviter.name,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
  }));

  return (
    <div className="px-8 py-7 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Project invitations addressed to you.
        </p>
      </div>
      <InboxPanel invitations={invitations} />
    </div>
  );
}
