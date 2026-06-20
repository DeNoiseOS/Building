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
import { resolveHeadRoleFromPresent } from "@/lib/department-registry";
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
import { PurchaseSheet } from "@/components/purchases/purchase-sheet";
import { PurchaseList, type PurchaseRow } from "@/components/purchases/purchase-list";
import {
  DEPARTMENTS,
  getCategoriesFor,
  getDepartmentByKey,
  getDepartmentByHeadRole,
} from "@/lib/department-registry";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    department?: string;
    requester?: string;
  }>;
}

export default async function BudgetPage(props: PageProps) {
  // V0.13 debug — wrap the entire render in try/catch so we can render
  // the *actual* error message inline (Next.js sanitizes the message
  // before it reaches error.tsx in production builds). Once we know
  // the cause, this wrapper can be removed.
  try {
    return await BudgetPageInner(props);
  } catch (err) {
    const e = err as Error;
    return (
      <div className="px-8 py-7 space-y-3">
        <h1 className="text-2xl font-semibold">Budget page failed (inline)</h1>
        <pre className="rounded-lg bg-card/60 border border-white/[0.06] p-4 text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap">
          <strong>{e?.name ?? "Error"}: {e?.message ?? String(err)}</strong>
          {e?.stack ? `\n\n${e.stack}` : ""}
        </pre>
      </div>
    );
  }
}

async function BudgetPageInner({ params, searchParams }: PageProps) {
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
    // V0.12.2 — producer-equivalent authority covers Owner / EP / Producer.
    const isProducer =
      isOwner ||
      (!!member &&
        (member.role === "producer" || member.role === "executive_producer"));
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
      {/* V0.13 — Purchases (project-wide view: read-only) */}
      {await renderPurchasesProjectInline(id, project?.currency ?? "SAR")}
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
  // V0.12.3 — resolve "am I the dept head?" with the V0.11 priority list,
  // not a static memberRole === department.kind compare.
  if (member?.role) {
    const allRoles = await prisma.projectMember.findMany({
      where: { projectId: id },
      select: { role: true },
    });
    const presentRoles = allRoles.map((r) => r.role);
    dept.departments.forEach((d) => {
      const reg = getDepartmentByHeadRole(d.department.kind);
      if (!reg) return;
      const resolved = resolveHeadRoleFromPresent(reg.key, presentRoles);
      if (resolved === member.role) headOfDeptIds.add(d.department.id);
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
    {/* V0.13 — Purchases (head-of-dept view) */}
    {await renderPurchasesHeadInline(
      id,
      dept.currency,
      cctxDept.myHeadOfDeptIds,
      projectMembersForDept.map((m) => ({
        id: m.user.id,
        name: m.user.name,
      }))
    )}
    </div>
  );
}

/* ───────────────────── V0.13 — Purchase sections ───────────────────── */

async function renderPurchasesProjectInline(
  projectId: string,
  currency: string
): Promise<React.ReactNode> {
  return PurchasesProjectSection({ projectId, currency });
}

async function renderPurchasesHeadInline(
  projectId: string,
  currency: string,
  myDeptIds: string[],
  members: Array<{ id: string; name: string }>
): Promise<React.ReactNode> {
  return PurchasesHeadSection({
    projectId,
    currency,
    myDeptIds,
    allDepartmentsForDept: [],
    members,
  });
}

async function PurchasesProjectSection({
  projectId,
  currency,
}: {
  projectId: string;
  currency: string;
}) {
  // V0.13 — defensive: if the Prisma client on Vercel was generated
  // before the V0.13 migration, `prisma.purchase` itself is undefined
  // and `.findMany` throws synchronously before any .catch attaches.
  // Guard the access so the rest of the budget page still renders.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseModel = (prisma as any).purchase;
  if (!purchaseModel || typeof purchaseModel.findMany !== "function") {
    return null;
  }
  const rows = await purchaseModel
    .findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        department: { select: { id: true, name: true, kind: true } },
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
    .catch((err: unknown) => {
      console.error("[PurchasesProjectSection]", err);
      return [];
    });
  if (!rows || rows.length === 0) {
    return (
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft px-5 py-6 text-sm text-muted-foreground">
        No purchases recorded yet.
      </section>
    );
  }
  const purchases: PurchaseRow[] = rows.map((p: any) => ({
    id: p.id,
    type: p.type as "purchase" | "rental",
    categoryKey: p.categoryKey,
    customCategory: p.customCategory,
    name: p.name,
    amount: p.amount,
    vendor: p.vendor,
    purchaseDate: p.purchaseDate?.toISOString() ?? null,
    rentalStart: p.rentalStart?.toISOString() ?? null,
    rentalEnd: p.rentalEnd?.toISOString() ?? null,
    receiptUrl: p.receiptUrl,
    paymentStatus: p.paymentStatus as "paid" | "unpaid",
    department: { id: p.department.id, name: p.department.name },
    assignee: p.assignee,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
  }));
  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-base font-semibold">Purchases & Rentals</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Recent activity across every department.
        </p>
      </div>
      <div className="p-3">
        <PurchaseList
          projectId={projectId}
          purchases={purchases}
          currency={currency}
          canManage={() => false}
        />
      </div>
    </section>
  );
}

async function PurchasesHeadSection({
  projectId,
  currency,
  myDeptIds,
  allDepartmentsForDept,
  members,
}: {
  projectId: string;
  currency: string;
  myDeptIds: string[];
  allDepartmentsForDept: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
}) {
  if (myDeptIds.length === 0) return null;

  // V0.13 — same guard as above: tolerate a stale Prisma client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseModel = (prisma as any).purchase;
  if (!purchaseModel || typeof purchaseModel.findMany !== "function") {
    return null;
  }

  const [rows, deptsFull] = await Promise.all([
    purchaseModel
      .findMany({
        where: { projectId, departmentId: { in: myDeptIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          department: { select: { id: true, name: true, kind: true } },
          assignee: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      })
      .catch((err: unknown) => {
        console.error("[PurchasesHeadSection.purchases]", err);
        return [];
      }),
    prisma.department.findMany({
      where: { id: { in: myDeptIds } },
      select: { id: true, name: true, key: true },
    }),
  ]);

  const purchases: PurchaseRow[] = rows.map((p: any) => ({
    id: p.id,
    type: p.type as "purchase" | "rental",
    categoryKey: p.categoryKey,
    customCategory: p.customCategory,
    name: p.name,
    amount: p.amount,
    vendor: p.vendor,
    purchaseDate: p.purchaseDate?.toISOString() ?? null,
    rentalStart: p.rentalStart?.toISOString() ?? null,
    rentalEnd: p.rentalEnd?.toISOString() ?? null,
    receiptUrl: p.receiptUrl,
    paymentStatus: p.paymentStatus as "paid" | "unpaid",
    department: { id: p.department.id, name: p.department.name },
    assignee: p.assignee,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
  }));

  // Build the category maps for the dept(s) the head can post in.
  const purchaseCategoriesByDept: Record<
    string,
    Array<{ key: string; label: string; isResource: boolean }>
  > = {};
  const rentalCategoriesByDept: Record<
    string,
    Array<{ key: string; label: string; isResource: boolean }>
  > = {};
  for (const d of deptsFull) {
    purchaseCategoriesByDept[d.key] = getCategoriesFor(d.key, "purchase");
    rentalCategoriesByDept[d.key] = getCategoriesFor(d.key, "rental");
  }

  void DEPARTMENTS;
  void getDepartmentByKey;
  void getDepartmentByHeadRole;

  const myDeptsForSheet = deptsFull.map((d) => ({
    id: d.id,
    name: d.name,
    key: d.key,
  }));

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <div>
          <h2 className="text-base font-semibold">Purchases & Rentals</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recorded against your department&apos;s budget.
          </p>
        </div>
        <PurchaseSheet
          projectId={projectId}
          myDepartments={myDeptsForSheet}
          purchaseCategoriesByDept={purchaseCategoriesByDept}
          rentalCategoriesByDept={rentalCategoriesByDept}
          members={members}
          currency={currency}
        />
      </div>
      <div className="p-3">
        <PurchaseList
          projectId={projectId}
          purchases={purchases}
          currency={currency}
          canManage={(deptId) => myDeptIds.includes(deptId)}
        />
      </div>
    </section>
  );
}
