import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Printer, FileBarChart2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import {
  assetTypesForDept,
  assetTypeLabel,
  deptHasSpecializedTypes,
} from "@/lib/scheduling/asset-types";
import { deptIconFor } from "@/components/scheduling/dept-icons";
import { Button } from "@/components/ui/button";

/**
 * V0.31 — Department Asset Report.
 *
 * Per-department printable report showing:
 *   • Total asset count grouped by assetType (Action: 5 · Raccord: 3)
 *   • Every scene the department appears in + which assets each scene
 *     needs + their per-scene effective type
 *
 * The Art head prints this and hands it to their team; same for
 * Camera, Sound, Wardrobe, Makeup, Lighting, Grip.
 */
export default async function DepartmentReportPage({
  params,
}: {
  params: Promise<{ id: string; deptId: string }>;
}) {
  const { id: projectId, deptId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const project = await prisma.project.findFirst({
    where: { AND: [projectAccessFilter(userId), { id: projectId }] },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const dept = await prisma.department.findFirst({
    where: { id: deptId, projectId },
    select: { id: true, name: true, kind: true },
  });
  if (!dept) notFound();

  const [equipment, sceneAssets, sceneDemandRows] = await Promise.all([
    prisma.equipment.findMany({
      where: { departmentId: deptId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        assetType: true,
        quantity: true,
        category: true,
        status: true,
      },
    }),
    prisma.sceneAsset.findMany({
      where: { equipment: { departmentId: deptId } },
      include: {
        scene: {
          select: {
            id: true,
            number: true,
            title: true,
            type: true,
            timeOfDay: true,
            location: true,
          },
        },
        equipment: {
          select: {
            id: true,
            name: true,
            assetType: true,
          },
        },
      },
      orderBy: [{ scene: { number: "asc" } }],
    }),
    prisma.sceneAsset.groupBy({
      by: ["equipmentId"],
      where: { equipment: { departmentId: deptId } },
      _sum: { quantityNeeded: true },
    }),
  ]);

  const demandByEq = new Map<string, number>();
  for (const d of sceneDemandRows) {
    demandByEq.set(d.equipmentId, d._sum.quantityNeeded ?? 0);
  }

  const hasTypes = deptHasSpecializedTypes(dept.kind);
  const typeOptions = assetTypesForDept(dept.kind);
  const DeptIcon = deptIconFor(dept.kind);

  // Aggregate: totals per assetType across all Equipment in this dept
  const totalsByType = new Map<string, number>();
  for (const e of equipment) {
    const key = e.assetType ?? "general";
    totalsByType.set(key, (totalsByType.get(key) ?? 0) + 1);
  }

  // Group scene-assets by scene
  const perScene = new Map<
    string,
    {
      scene: (typeof sceneAssets)[number]["scene"];
      items: (typeof sceneAssets)[number][];
    }
  >();
  for (const sa of sceneAssets) {
    const key = sa.scene.id;
    if (!perScene.has(key)) {
      perScene.set(key, { scene: sa.scene, items: [] });
    }
    perScene.get(key)!.items.push(sa);
  }
  const scenes = Array.from(perScene.values());

  return (
    <div className="call-sheet-print min-h-screen bg-white text-black">
      {/* Print bar (screen only) */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/10 px-4 h-12 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${projectId}/departments/${deptId}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-black/70 hover:text-black transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to department
        </Link>
        <Button
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="h-8 text-[12px] bg-black text-white hover:bg-black/85"
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Print / Save PDF
        </Button>
      </div>

      <article className="max-w-[900px] mx-auto px-8 py-8 print:px-6 print:py-6 text-[12px] leading-normal">
        {/* Header */}
        <header className="border-b-2 border-black pb-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-black/60">
              {project.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <DeptIcon className="h-5 w-5" />
              <h1
                className="text-[28px] leading-none tracking-tight"
                style={{ fontFamily: "var(--font-serif-denoise, Georgia, serif)" }}
              >
                {dept.name} Report
              </h1>
            </div>
          </div>
          <div className="text-right text-[10px] uppercase tracking-[0.16em] text-black/60">
            <p>Generated</p>
            <p className="tabular-nums">
              {format(new Date(), "MMM d, yyyy · HH:mm")}
            </p>
          </div>
        </header>

        {/* Totals by type */}
        <section className="mb-6 break-inside-avoid">
          <h2 className="text-[9px] uppercase tracking-[0.22em] text-black/60 mb-2">
            Inventory by Type
          </h2>
          {hasTypes ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {typeOptions.map((t) => {
                const count = totalsByType.get(t.key) ?? 0;
                return (
                  <div
                    key={t.key}
                    className="border border-black/40 bg-white"
                  >
                    <div className="bg-black text-white px-3 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.18em]">
                        {t.label}
                      </p>
                    </div>
                    <div className="px-3 py-3">
                      <p
                        className="text-[28px] tabular-nums leading-none"
                        style={{
                          fontFamily: "var(--font-serif-denoise, Georgia, serif)",
                        }}
                      >
                        {count}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-black/60 mt-1">
                        item{count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-black/70">
              This department has no specialized asset types. Total inventory:{" "}
              <span className="font-medium tabular-nums">
                {equipment.length}
              </span>{" "}
              item{equipment.length === 1 ? "" : "s"}.
            </p>
          )}
        </section>

        {/* Full equipment list */}
        {equipment.length > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="text-[9px] uppercase tracking-[0.22em] text-black/60 mb-2">
              Full Inventory
            </h2>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-1.5 pr-2 font-medium">Item</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 pr-2 font-medium">Category</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Stock</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Used</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Free</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e) => {
                  const used = demandByEq.get(e.id) ?? 0;
                  const free = e.quantity - used;
                  return (
                    <tr key={e.id} className="border-b border-black/20">
                      <td className="py-1.5 pr-2 font-medium">{e.name}</td>
                      <td className="py-1.5 pr-2 text-black/70">
                        {assetTypeLabel(dept.kind, e.assetType)}
                      </td>
                      <td className="py-1.5 pr-2 text-black/60">
                        {e.category ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums text-right">
                        {e.quantity}
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums text-right text-black/70">
                        {used}
                      </td>
                      <td
                        className={
                          "py-1.5 pr-2 tabular-nums text-right font-medium " +
                          (free < 0
                            ? "text-red-700"
                            : free === 0
                              ? "text-amber-700"
                              : "text-emerald-700")
                        }
                      >
                        {free < 0 ? `SHORT ${-free}` : free}
                      </td>
                      <td className="py-1.5 uppercase text-[10px] tracking-[0.14em] text-black/60">
                        {e.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Per-scene breakdown */}
        {scenes.length > 0 && (
          <section className="break-before-page">
            <h2 className="text-[9px] uppercase tracking-[0.22em] text-black/60 mb-2">
              Per-Scene Requirements
            </h2>
            <div className="space-y-3">
              {scenes.map(({ scene, items }) => {
                // Group items by effective type
                const byType = new Map<string, typeof items>();
                for (const it of items) {
                  const key =
                    it.assetTypeOverride ?? it.equipment.assetType ?? "general";
                  if (!byType.has(key)) byType.set(key, []);
                  byType.get(key)!.push(it);
                }
                const typeKeys = Array.from(byType.keys()).sort((a, b) =>
                  a === "general" ? 1 : b === "general" ? -1 : a.localeCompare(b)
                );
                return (
                  <div
                    key={scene.id}
                    className="border border-black/40 bg-white break-inside-avoid"
                  >
                    <div className="bg-black text-white px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[11px] font-medium tabular-nums">
                        Scene {scene.number}
                      </span>
                      <span className="text-[10px] opacity-70">·</span>
                      <span className="text-[11px] truncate">{scene.title}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-[0.16em] opacity-80">
                        {scene.type} · {scene.timeOfDay}
                        {scene.location && ` · ${scene.location}`}
                      </span>
                    </div>
                    <div className="px-3 py-2.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {typeKeys.map((key) => (
                        <div key={key}>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-black/60 font-medium">
                            {assetTypeLabel(dept.kind, key)} · {byType.get(key)!.length}
                          </p>
                          <ul className="text-[11px] mt-1 space-y-0.5">
                            {byType.get(key)!.map((it) => (
                              <li key={it.id}>
                                {it.equipment.name}
                                {it.quantityNeeded > 1 && (
                                  <span className="text-black/60">
                                    {" "}× {it.quantityNeeded}
                                  </span>
                                )}
                                {it.notes && (
                                  <span className="text-black/60 text-[10px]">
                                    {" · "}{it.notes}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-10 pt-4 border-t border-black/30 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-black/50">
          <span>
            <FileBarChart2 className="h-3 w-3 inline mr-1" />
            {dept.name} · DeNoise OS Report
          </span>
          <span>{project.name}</span>
        </footer>
      </article>
    </div>
  );
}
