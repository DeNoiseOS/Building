import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { CommentThread } from "@/components/shared/comment-thread";

interface PageProps {
  params: Promise<{ id: string; deptId: string }>;
}

export default async function DepartmentDiscussionPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, deptId } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  const dept = await prisma.department.findFirst({
    where: { id: deptId, projectId: id },
    select: { id: true, name: true, kind: true },
  });
  if (!dept) notFound();

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  return (
    <div className="space-y-6 pt-2">
      <div>
        <Link
          href={`/projects/${id}/departments/${deptId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {dept.name}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dept.name} Discussion
          </h1>
          <p className="text-sm text-muted-foreground">
            Threaded department conversation. Mention with @.
          </p>
        </div>
      </div>

      <CommentThread
        targetType="department_discussion"
        targetId={dept.id}
        currentUser={currentUser}
        projectId={id}
        allowReplies
      />
    </div>
  );
}
