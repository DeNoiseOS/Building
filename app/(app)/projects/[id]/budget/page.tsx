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
  getDepartmentForRole,
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
          // V0.14.1 — Purchases linked to this custody count toward spent.
          purchases: {
            where: { status: "approved" },
            select: { amount: true },
          },
        },
      }),
      getProjectCustodyTotals(id),
    ]);
    const custodies = custodyRows.map((c) => {
      const legacySpent = c.expenses.reduce((s, e) => s + e.estimatedCost, 0);
      const purchaseSpent = (
        c as unknown as { purchases?: Array<{ amount: number }> }
      ).purchases?.reduce((s, p) => s + p.amount, 0) ?? 0;
      const spent = legacySpent + purchaseSpent;
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
      // V0.14.1 — Purchases linked to this custody count toward spent.
      purchases: {
        where: { status: "approved" },
        select: { amount: true },
      },
    },
  });
  const custodyTotalsDept = await getProjectCustodyTotals(id);
  const custodiesDept = custodyRowsDept.map((c) => {
    const legacySpent = c.expenses.reduce((s, e) => s + e.estimatedCost, 0);
    // V0.14.1 — also include approved Purchase amounts linked to this custody.
    const purchaseSpent = (
      c as unknown as { purchases?: Array<{ amount: number }> }
    ).purchases?.reduce((s, p) => s + p.amount, 0) ?? 0;
    const spent = legacySpent + purchaseSpent;
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

  // V0.12.3 — for the custody dialog, restrict pickers to:
  //  - departments the caller is the resolved head of
  //  - members whose role belongs to one of those departments
  //    (we resolve dept membership via the registry, matching roles
  //     to department keys — same approach the resolver uses).
  const myDeptIdSet = new Set(cctxDept.myHeadOfDeptIds);
  const custodyDepartments = allDepartmentsForDept.filter((d) =>
    myDeptIdSet.has(d.id)
  );
  const myDeptKeys = new Set(
    custodyDepartments
      .map((d) => {
        const fullDept = dept.departments.find((x) => x.department.id === d.id);
        if (!fullDept) return null;
        const reg = getDepartmentByHeadRole(fullDept.department.kind);
        return reg?.key ?? null;
      })
      .filter((k): k is string => k !== null)
  );
  const custodyMembers = projectMembersForDept
    .filter((m) => {
      // Always include the caller themselves.
      if (m.user.id === session.user.id) return true;
      const reg = getDepartmentForRole(m.role);
      return reg ? myDeptKeys.has(reg.key) : false;
    })
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      role: m.role,
    }));

  // V0.14.1 — is the caller a plain dept member (not head, not owner)?
  const callerIsHead =
    cctxDept.isOwner || cctxDept.myHeadOfDeptIds.length > 0;

  // V0.14.1 — caller's open custodies keyed by departmentId
  // (used to render the "Recording against custody" banner in the sheet).
  const myActiveCustodies = await prisma.custody.findMany({
    where: {
      projectId: id,
      holderUserId: session.user.id,
      status: "active",
    },
    select: { id: true, departmentId: true, amount: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseModelForBanner = (prisma as any).purchase;
  const callerCustodyByDept: Record<
    string,
    { id: string; amount: number; remaining: number }
  > = {};
  for (const c of myActiveCustodies) {
    let spent = 0;
    if (
      purchaseModelForBanner &&
      typeof purchaseModelForBanner.aggregate === "function"
    ) {
      const agg = await purchaseModelForBanner
        .aggregate({
          where: { custodyId: c.id, status: "approved" },
          _sum: { amount: true },
        })
        .catch(() => null);
      spent = agg?._sum?.amount ?? 0;
    }
    callerCustodyByDept[c.departmentId] = {
      id: c.id,
      amount: c.amount,
      remaining: c.amount - spent,
    };
  }

  return (
    <div className="space-y-6">
    {/* V0.14.1 — Dept Budget panel hidden from plain members. */}
    {callerIsHead && (
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
    )}
    {/* V0.12.3 — always render so resolved heads can issue the FIRST
        custody. The panel itself handles the empty state. */}
    {(custodiesDept.length > 0 || canIssueCustody(cctxDept) || !cctxDept.isOwner) && (
      <CustodyPanel
        projectId={id}
        currency={dept.currency}
        canIssue={canIssueCustody(cctxDept)}
        canApproveSettlement={canApproveSettlement(cctxDept)}
        custodies={custodiesDept}
        departments={custodyDepartments}
        members={custodyMembers}
        totals={custodyTotalsDept}
        canRequestCustody={!cctxDept.isOwner && dept.departments.length > 0}
        myRequestDepartments={dept.departments.map((d) => ({
          id: d.department.id,
          name: d.department.name,
        }))}
        custodyRequests={await loadDeptCustodyRequests(
          id,
          session.user.id,
          cctxDept.isOwner,
          cctxDept.memberRole,
          cctxDept.myHeadOfDeptIds
        )}
        approvableRequestDeptIds={cctxDept.myHeadOfDeptIds}
        currentUserId={session.user.id}
      />
    )}
    {/* V0.13 — Purchases (dept-scope view). V0.14: any dept member can
        record (pending); only the resolved head can approve. */}
    {await renderPurchasesHeadInline({
      projectId: id,
      currency: dept.currency,
      // myDeptIds = union of (head depts) + (dept memberships) + (role-derived).
      myDeptIds: Array.from(
        new Set([
          ...cctxDept.myHeadOfDeptIds,
          ...cctxDept.myDepartmentIds,
          ...dept.departments.map((d) => d.department.id),
        ])
      ),
      approvableDeptIds: cctxDept.myHeadOfDeptIds,
      members: projectMembersForDept.map((m) => ({
        id: m.user.id,
        name: m.user.name,
      })),
      callerIsMember: !callerIsHead,
      callerName: session.user.name ?? "you",
      callerCustodyByDept,
      callerUserId: session.user.id,
    })}
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

async function loadDeptCustodyRequests(
  projectId: string,
  callerUserId: string,
  isOwner: boolean,
  memberRole: string | null,
  myHeadOfDeptIds: string[]
): Promise<
  Array<{
    id: string;
    amount: number;
    reason: string;
    status: "pending" | "approved" | "rejected";
    decisionReason: string | null;
    createdAt: string;
    requester: { id: string; name: string };
    department: { id: string; name: string };
  }>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).custodyRequest;
  if (!m || typeof m.findMany !== "function") return [];

  // Visibility mirrors the API:
  //   Owner / Producer / EP / Director  → all on project
  //   Resolved head                     → in their depts + own
  //   Anyone else                       → only own
  const where: Record<string, unknown> = { projectId };
  if (
    !isOwner &&
    memberRole !== "producer" &&
    memberRole !== "executive_producer" &&
    memberRole !== "director"
  ) {
    if (myHeadOfDeptIds.length > 0) {
      where.OR = [
        { departmentId: { in: myHeadOfDeptIds } },
        { requesterUserId: callerUserId },
      ];
    } else {
      where.requesterUserId = callerUserId;
    }
  }

  const rows = await m
    .findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        requester: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    })
    .catch(() => []);

  return rows.map(
    (r: {
      id: string;
      amount: number;
      reason: string;
      status: string;
      decisionReason: string | null;
      createdAt: Date;
      requester: { id: string; name: string };
      department: { id: string; name: string };
    }) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      status: r.status as "pending" | "approved" | "rejected",
      decisionReason: r.decisionReason,
      createdAt: r.createdAt.toISOString(),
      requester: r.requester,
      department: r.department,
    })
  );
}

async function renderPurchasesHeadInline(args: {
  projectId: string;
  currency: string;
  myDeptIds: string[];
  approvableDeptIds: string[];
  members: Array<{ id: string; name: string }>;
  callerIsMember: boolean;
  callerName: string;
  callerCustodyByDept: Record<
    string,
    { id: string; amount: number; remaining: number }
  >;
  callerUserId: string;
}): Promise<React.ReactNode> {
  return PurchasesHeadSection({
    ...args,
    allDepartmentsForDept: [],
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
    quantity: p.quantity,
    amount: p.amount,
    vendor: p.vendor,
    purchaseDate: p.purchaseDate?.toISOString() ?? null,
    rentalStart: p.rentalStart?.toISOString() ?? null,
    rentalEnd: p.rentalEnd?.toISOString() ?? null,
    receiptUrl: p.receiptUrl,
    paymentStatus: p.paymentStatus as "paid" | "unpaid",
    status: p.status as "pending" | "approved" | "rejected" | undefined,
    approvedAt: p.approvedAt?.toISOString() ?? null,
    rejectedAt: p.rejectedAt?.toISOString() ?? null,
    rejectionReason: p.rejectionReason,
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
          manageableDepartmentIds={[]}
        />
      </div>
    </section>
  );
}

async function PurchasesHeadSection({
  projectId,
  currency,
  myDeptIds,
  approvableDeptIds,
  allDepartmentsForDept,
  members,
  callerIsMember,
  callerName,
  callerCustodyByDept,
  callerUserId,
}: {
  projectId: string;
  currency: string;
  myDeptIds: string[];
  approvableDeptIds: string[];
  allDepartmentsForDept: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  callerIsMember: boolean;
  callerName: string;
  callerCustodyByDept: Record<
    string,
    { id: string; amount: number; remaining: number }
  >;
  callerUserId: string;
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
        where: {
          projectId,
          departmentId: { in: myDeptIds },
          // V0.14.1 — plain members only see their own purchases.
          ...(callerIsMember ? { createdByUserId: callerUserId } : {}),
        },
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
    quantity: p.quantity,
    amount: p.amount,
    vendor: p.vendor,
    purchaseDate: p.purchaseDate?.toISOString() ?? null,
    rentalStart: p.rentalStart?.toISOString() ?? null,
    rentalEnd: p.rentalEnd?.toISOString() ?? null,
    receiptUrl: p.receiptUrl,
    paymentStatus: p.paymentStatus as "paid" | "unpaid",
    status: p.status as "pending" | "approved" | "rejected" | undefined,
    approvedAt: p.approvedAt?.toISOString() ?? null,
    rejectedAt: p.rejectedAt?.toISOString() ?? null,
    rejectionReason: p.rejectionReason,
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
          callerIsMember={callerIsMember}
          callerName={callerName}
          callerCustodyByDept={callerCustodyByDept}
        />
      </div>
      <div className="p-3">
        <PurchaseList
          projectId={projectId}
          purchases={purchases}
          currency={currency}
          manageableDepartmentIds={approvableDeptIds}
          approvableDepartmentIds={approvableDeptIds}
          currentUserId={callerUserId}
        />
      </div>
    </section>
  );
}
