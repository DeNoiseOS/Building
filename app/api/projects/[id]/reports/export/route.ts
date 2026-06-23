import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, forbidden, notFound } from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { canViewAnalytics } from "@/lib/permissions";
import { toCSV, exportFilename } from "@/lib/csv";

/**
 * V0.21 — Reports CSV export.
 *
 * Single endpoint, `?kind=financial|departments|scenes`. Streams
 * `text/csv` with a project-stamped filename. Auth: canViewAnalytics
 * (Director / AD / Producer / EP / Owner).
 *
 * No PDF here — the /reports page is print-friendly (V0.21 stylesheet),
 * so users hit ⌘P → Save as PDF.
 */
type Kind = "financial" | "departments" | "scenes";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");
  if (
    !(await canViewAnalytics({ userId: guard.userId, projectId: id }))
  ) {
    return forbidden("Only project leads can export reports.");
  }

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "") as Kind;
  if (!["financial", "departments", "scenes"].includes(kind)) {
    return badRequest("Unknown report kind.");
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, currency: true },
  });
  if (!project) return notFound("Project not found.");
  // All supported currencies use 2 minor units. Keep it simple.
  const fmtMinor = (cents: number | null | undefined) =>
    cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

  let csv: string;
  if (kind === "financial") csv = await buildFinancialCSV(id, fmtMinor);
  else if (kind === "departments") csv = await buildDepartmentsCSV(id, fmtMinor);
  else csv = await buildScenesCSV(id);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(project.name, kind)}"`,
    },
  });
}

async function buildFinancialCSV(
  projectId: string,
  fmt: (c: number | null | undefined) => string
): Promise<string> {
  const purchases = await prisma.purchase.findMany({
    where: { projectId },
    include: {
      department: { select: { name: true } },
      assignee: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  type Row = (typeof purchases)[number] & {
    department: { name: string } | null;
    assignee: { name: string } | null;
    createdBy: { name: string } | null;
  };
  const rows: Array<Array<string | number | null>> = [
    [
      "Date",
      "Type",
      "Department",
      "Name",
      "Category",
      "Quantity",
      "Amount",
      "Status",
      "Assignee",
      "Created by",
      "Description",
    ],
  ];
  for (const p of purchases as Row[]) {
    rows.push([
      p.createdAt.toISOString().slice(0, 10),
      p.type,
      p.department?.name ?? "",
      p.name,
      p.customCategory ?? p.categoryKey ?? "",
      p.quantity,
      fmt(p.amount),
      p.status,
      p.assignee?.name ?? "",
      p.createdBy?.name ?? "",
      p.description ?? "",
    ]);
  }
  return toCSV(rows);
}

async function buildDepartmentsCSV(
  projectId: string,
  fmt: (c: number | null | undefined) => string
): Promise<string> {
  const depts = await prisma.department.findMany({
    where: { projectId },
    include: {
      budget: {
        select: {
          allocatedAmount: true,
          requestedAmount: true,
          approvedAmount: true,
          status: true,
        },
      },
      _count: {
        select: { members: true, equipment: true, purchases: true },
      },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  // Spent = sum of approved purchases.
  const spentByDept = new Map<string, number>();
  const purchaseSpent = await prisma.purchase.groupBy({
    by: ["departmentId"],
    where: { projectId, status: "approved" },
    _sum: { amount: true },
  });
  for (const r of purchaseSpent as Array<{
    departmentId: string;
    _sum: { amount: number | null };
  }>) {
    spentByDept.set(r.departmentId, r._sum.amount ?? 0);
  }
  type Row = (typeof depts)[number];
  const rows: Array<Array<string | number | null>> = [
    [
      "Department",
      "Kind",
      "Members",
      "Resources",
      "Purchases",
      "Budget allocated",
      "Budget approved",
      "Status",
      "Spent",
      "Remaining",
    ],
  ];
  for (const d of depts as Row[]) {
    const allocated = d.budget?.allocatedAmount ?? 0;
    const approved = d.budget?.approvedAmount ?? allocated;
    const spent = spentByDept.get(d.id) ?? 0;
    rows.push([
      d.name,
      d.kind,
      d._count.members,
      d._count.equipment,
      d._count.purchases,
      fmt(allocated),
      fmt(approved),
      d.budget?.status ?? "—",
      fmt(spent),
      fmt(approved - spent),
    ]);
  }
  return toCSV(rows);
}

async function buildScenesCSV(projectId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneModel = (prisma as any).scene;
  if (!sceneModel) return toCSV([["No scenes module."]]);
  const scenes = await sceneModel.findMany({
    where: { projectId },
    include: {
      departments: { select: { enabled: true, approvalStatus: true } },
      assets: { select: { id: true } },
    },
    orderBy: { number: "asc" },
  });
  type Row = {
    number: string;
    title: string;
    location: string | null;
    type: string;
    timeOfDay: string;
    status: string;
    departments: Array<{ enabled: boolean; approvalStatus: string }>;
    assets: Array<{ id: string }>;
  };
  const rows: Array<Array<string | number | null>> = [
    [
      "Number",
      "Title",
      "Location",
      "Type",
      "Time",
      "Status",
      "Departments active",
      "Departments approved",
      "Assets linked",
    ],
  ];
  for (const s of scenes as Row[]) {
    const enabled = s.departments.filter((d) => d.enabled);
    const approved = enabled.filter((d) => d.approvalStatus === "approved");
    rows.push([
      s.number,
      s.title,
      s.location ?? "",
      s.type,
      s.timeOfDay,
      s.status,
      enabled.length,
      approved.length,
      s.assets.length,
    ]);
  }
  return toCSV(rows);
}
