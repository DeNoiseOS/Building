import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import {
  getProjectBudget,
  getDepartmentBudgetDashboard,
} from "@/lib/project-budget";
import {
  resolveBudgetContext,
  budgetVisibilityFilter,
  canApproveBudget,
} from "@/lib/budget-data";
import { canViewProjectBudget } from "@/lib/permissions";
import {
  resolveCustodyContext,
  canIssueCustody,
  canApproveSettlement,
  custodyVisibilityFilter,
  getProjectCustodyTotals,
} from "@/lib/custody-data";
import { BudgetPanel } from "@/components/budget/budget-panel";
import { DepartmentBudgetPanel } from "@/components/budget/department-budget-panel";
import { CustodyPanel } from "@/components/budget/custody-panel";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    department?: string;
    requester?: string;
  }>;
}

export default async function BudgetPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  const canViewProjectWide = await canViewProjectBudget({
    userId: session.user.id,
    projectId: id,
  });

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  // ─── Project-wide payload (Owner / Producer / Director) ──────────────
  if (canViewProjectWide) {
    const [project, member, ownerRow, bctx, budget] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: { totalBudget: true, currency: true, name: true },
      }),
      prisma.projectMember.findFirst({
        where: { projectId: id, userId: session.user.id },
        select: { role: true },
      }),
      prisma.project.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      }),
      resolveBudgetContext(session.user.id, id),
      getProjectBudget(id),
    ]);

    const isOwner = !!ownerRow;
    const isProducer = isOwner || (!!member && member.role === "producer");
    const purchaseWhere: Record<string, unknown> = {
      projectId: id,
      ...budgetVisibilityFilter(bctx),
    };
    if (sp.status) purchaseWhere.status = sp.status;
    if (sp.department) purchaseWhere.departmentId = sp.department;
    if (sp.requester) purchaseWhere.requesterId = sp.requester;

    const [requests, projectMembers, allDepartments] = await Promise.all([
      prisma.budgetRequest.findMany({
        where: purchaseWhere,
        orderBy: { updatedAt: "desc" },
        include: {
          department: { select: { id: true, name: true, kind: true } },
          requester: { select: { id: true, name: true } },
        },
      }),
      prisma.projectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.department.findMany({
        where: { projectId: id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
    ]);

    // V0.9 — Custodies + financial summary for project-wide viewers.
    const cctx = await resolveCustodyContext(session.user.id, id);
    const [custodyRows, custodyTotals] = await Promise.all([
      prisma.custody.findMany({
        where: { projectId: id, ...custodyVisibilityFilter(cctx) },
        orderBy: { issuedAt: "desc" },
        include: {
          department: { select: { id: true, name: true, kind: true } },
          holder: { select: { id: true, name: true } },
          issuedBy: { select: { id: true, name: true } },
          expenses: {
            where: { status: "purchased" },
            select: { estimatedCost: true },
          },
        },
      }),
      getProjectCustodyTotals(id),
    ]);
    const custodies = custodyRows.map((c) => {
      const spent = c.expenses.reduce((s, e) => s + e.estimatedCost, 0);
      return {
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        settlementStatus: c.settlementStatus,
        settledAt: c.settledAt?.toISOString() ?? null,
        issuedAt: c.issuedAt.toISOString(),
        notes: c.notes,
        spent,
        remaining: c.amount - spent,
        department: {
          id: c.department.id,
          name: c.department.name,
        },
        holder: c.holder,
        issuedBy: c.issuedBy,
      };
    });

    return (
      <div className="space-y-6">
      <BudgetPanel
        projectId={id}
        currency={project?.currency ?? "USD"}
        totalBudget={project?.totalBudget ?? null}
        budgetSummary={budget.summary}
        allocations={budget.departments}
        departments={allDepartments}
        currentUser={currentUser}
        isOwner={isOwner}
        canEditBudgetPool={isProducer}
        canApprove={canApproveBudget(bctx)}
        canResolveRevision={isProducer}
        isAnyHead={false}
        isProjectWide={true}
        myMemberRole={member?.role ?? null}
        myDepartmentIds={bctx.myDepartmentIds}
        requests={requests.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          vendor: r.vendor,
          estimatedCost: r.estimatedCost,
          needByDate: r.needByDate?.toISOString() ?? null,
          status: r.status,
          department: r.department,
          requester: r.requester,
          submittedAt: r.submittedAt?.toISOString() ?? null,
          approvedAt: r.approvedAt?.toISOString() ?? null,
          rejectedAt: r.rejectedAt?.toISOString() ?? null,
          purchasedAt: r.purchasedAt?.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(),
        }))}
        requesters={projectMembers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
        }))}
        filter={{
          status: sp.status ?? "",
          department: sp.department ?? "",
          requester: sp.requester ?? "",
        }}
      />
      <CustodyPanel
        projectId={id}
        currency={project?.currency ?? "USD"}
        canIssue={canIssueCustody(cctx)}
        canApproveSettlement={canApproveSettlement(cctx)}
        custodies={custodies}
        departments={allDepartments}
        members={projectMembers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
        }))}
        totals={custodyTotals}
      />
      </div>
    );
  }

  // ─── Department payload (everyone else) ────────────────────────────
  const dept = await getDepartmentBudgetDashboard(session.user.id, id);
  const myDeptIds = dept.departments.map((d) => d.department.id);

  // V0.9 — Custodies visible to dept head / member / holder.
  const cctxDept = await resolveCustodyContext(session.user.id, id);
  const custodyRowsDept = await prisma.custody.findMany({
    where: { projectId: id, ...custodyVisibilityFilter(cctxDept) },
    orderBy: { issuedAt: "desc" },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      holder: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true } },
      expenses: {
        where: { status: "purchased" },
        select: { estimatedCost: true },
      },
    },
  });
  const custodyTotalsDept = await getProjectCustodyTotals(id);
  const custodiesDept = custodyRowsDept.map((c) => {
    const spent = c.expenses.reduce((s, e) => s + e.estimatedCost, 0);
    return {
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      settlementStatus: c.settlementStatus,
      settledAt: c.settledAt?.toISOString() ?? null,
      issuedAt: c.issuedAt.toISOString(),
      notes: c.notes,
      spent,
      remaining: c.amount - spent,
      department: { id: c.department.id, name: c.department.name },
      holder: c.holder,
      issuedBy: c.issuedBy,
    };
  });

  // V0.6.3 — determine which of my departments I'm the *head* of, so the
  // panel can show approve / reject / mark-purchased actions inline.
  const [member, leadships] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { projectId: id, userId: session.user.id },
      select: { role: true },
    }),
    prisma.departmentMember.findMany({
      where: { userId: session.user.id, role: "lead", department: { projectId: id } },
      select: { departmentId: true },
    }),
  ]);
  const headOfDeptIds = new Set<string>(leadships.map((l) => l.departmentId));
  if (member?.role) {
    dept.departments.forEach((d) => {
      if (d.department.kind === member.role) headOfDeptIds.add(d.department.id);
    });
  }

  // Per-department purchase requests — strict (only my departments).
  const purchaseWhere: Record<string, unknown> = { projectId: id };
  if (myDeptIds.length === 0) {
    purchaseWhere.id = "__never__";
  } else {
    purchaseWhere.departmentId = { in: myDeptIds };
  }
  if (sp.status) purchaseWhere.status = sp.status;
  if (sp.department && myDeptIds.includes(sp.department)) {
    purchaseWhere.departmentId = sp.department;
  }
  if (sp.requester) purchaseWhere.requesterId = sp.requester;

  const requests = await prisma.budgetRequest.findMany({
    where: purchaseWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      requester: { select: { id: true, name: true } },
    },
  });

  const allDepartmentsForDept = await prisma.department.findMany({
    where: { projectId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
  const projectMembersForDept = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: { user: { select: { id: true, name: true } } },
  });

  return (
    <div className="space-y-6">
    <DepartmentBudgetPanel
      projectId={id}
      currency={dept.currency}
      departments={dept.departments}
      currentUser={currentUser}
      requests={requests.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        vendor: r.vendor,
        estimatedCost: r.estimatedCost,
        needByDate: r.needByDate?.toISOString() ?? null,
        status: r.status,
        department: r.department,
        requester: r.requester,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        rejectedAt: r.rejectedAt?.toISOString() ?? null,
        purchasedAt: r.purchasedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      }))}
      filter={{
        status: sp.status ?? "",
      }}
      headOfDeptIds={Array.from(headOfDeptIds)}
    />
    {custodiesDept.length > 0 && (
      <CustodyPanel
        projectId={id}
        currency={dept.currency}
        canIssue={canIssueCustody(cctxDept)}
        canApproveSettlement={canApproveSettlement(cctxDept)}
        custodies={custodiesDept}
        departments={allDepartmentsForDept}
        members={projectMembersForDept.map((m) => ({
          id: m.user.id,
          name: m.user.name,
        }))}
        totals={custodyTotalsDept}
      />
    )}
    </div>
  );
}
