"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ALL_SECTIONS = [
  { key: "cover", label: "Cover (logos, times, weather, location)" },
  { key: "schedule", label: "Shooting schedule" },
  { key: "cast", label: "Cast call" },
  { key: "crew", label: "Crew list" },
  { key: "clients", label: "Clients / Agency" },
  { key: "breakdowns", label: "Per-scene breakdowns" },
  { key: "notes", label: "Production notes page" },
] as const;

const PRESETS = [
  { key: "full", label: "🎬 Full crew", icon: "🎬" },
  { key: "sound", label: "🎵 Sound dept", icon: "🎵" },
  { key: "camera", label: "📷 Camera dept", icon: "📷" },
  { key: "art", label: "🎨 Art dept", icon: "🎨" },
  { key: "cast", label: "🎭 Cast only", icon: "🎭" },
  { key: "production", label: "📋 Production office", icon: "📋" },
] as const;

/**
 * V0.29 — Print bar for the Call Sheet page.
 *
 * Fixed strip at the top of the print view (screen only — hidden on
 * @media print). Owns:
 *   • Back link to the shoot day editor
 *   • Filters button → opens the Export sheet with section toggles +
 *     department filter + preset selector
 *   • Print button (browser print dialog → Save as PDF)
 *
 * Applying filters navigates to the same route with query params, so
 * the page re-renders server-side with the correct sections included.
 * Multi-select presets: user picks multiple presets, sheet opens a
 * new tab per preset before triggering print, so a single click can
 * export "Sound + Camera + Cast" as three separate PDFs.
 */
export function CallSheetPrintBar({
  projectId,
  dayId,
  activeSections,
  activeDeptKinds,
}: {
  projectId: string;
  dayId: string;
  activeSections: string[];
  activeDeptKinds: string[] | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(activeSections)
  );
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [availableDepts, setAvailableDepts] = useState<
    { id: string; name: string; kind: string; count: number }[]
  >([]);
  const [selectedDeptKinds, setSelectedDeptKinds] = useState<Set<string>>(
    activeDeptKinds ? new Set(activeDeptKinds) : new Set()
  );

  useEffect(() => {
    if (!open) return;
    // Fetch project departments that own equipment. Client-side fetch
    // so the print bar stays lightweight — we don't pass them from
    // the server unless the sheet is opened.
    fetch(`/api/projects/${projectId}/scheduling/departments`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) =>
        setAvailableDepts(
          Array.isArray(rows)
            ? rows.map((r: { id: string; name: string; kind: string; count: number }) => r)
            : []
        )
      )
      .catch(() => setAvailableDepts([]));
  }, [projectId, open]);

  function toggle(key: string, set: Set<string>, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  function apply() {
    const params = new URLSearchParams();
    if (selectedSections.size > 0 && selectedSections.size < ALL_SECTIONS.length) {
      params.set("sections", Array.from(selectedSections).join(","));
    }
    if (selectedDeptKinds.size > 0) {
      params.set("deptKinds", Array.from(selectedDeptKinds).join(","));
    }
    const qs = params.toString();
    router.push(
      `/projects/${projectId}/scheduling/${dayId}/call-sheet${
        qs ? `?${qs}` : ""
      }`
    );
    setOpen(false);
  }

  function applyPresetsAndPrint() {
    if (selectedPresets.size === 0) {
      apply();
      setTimeout(() => window.print(), 300);
      return;
    }
    const presets = Array.from(selectedPresets);
    // Open a tab per preset, then print each. First one prints in
    // this tab; the rest open new tabs.
    const [first, ...rest] = presets;
    for (const p of rest) {
      window.open(
        `/projects/${projectId}/scheduling/${dayId}/call-sheet?preset=${p}&print=1`,
        "_blank"
      );
    }
    router.push(
      `/projects/${projectId}/scheduling/${dayId}/call-sheet?preset=${first}`
    );
    setOpen(false);
    setTimeout(() => window.print(), 500);
  }

  // Auto-print when ?print=1 is in URL (used by the multi-preset flow)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("print") === "1") {
      setTimeout(() => window.print(), 400);
    }
  }, []);

  return (
    <div
      className={cn(
        "sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/10 px-4 h-12 flex items-center justify-between",
        "print:hidden"
      )}
    >
      <a
        href={`/projects/${projectId}/scheduling/${dayId}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-black/70 hover:text-black transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to shoot day
      </a>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-8 text-[12px] border-black/20 text-black hover:bg-black/5"
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          Filters
        </Button>
        <Button
          onClick={() => window.print()}
          className="h-8 text-[12px] bg-black text-white hover:bg-black/85"
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Print / Save PDF
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[440px] sm:max-w-[440px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
        >
          <SheetHeader className="border-b border-[var(--denoise-border)]">
            <SheetTitle className="text-[var(--denoise-cream)]">
              Export Call Sheet
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[var(--denoise-cream-muted)]">
              Choose exactly what appears on the printed sheet.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-auto flex-1 p-4 space-y-6 text-[13px]">
            {/* Presets */}
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)] mb-2">
                Quick presets
              </h3>
              <p className="text-[11px] text-[var(--denoise-cream-muted)] mb-2">
                Multi-select → each preset opens its own print job.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((p) => {
                  const active = selectedPresets.has(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() =>
                        toggle(p.key, selectedPresets, setSelectedPresets)
                      }
                      className={cn(
                        "rounded-[var(--radius-home)] border px-3 py-2 text-left transition-colors flex items-center gap-2",
                        active
                          ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]"
                          : "border-[var(--denoise-border)] bg-[var(--denoise-bg)] text-[var(--denoise-cream)] hover:border-[var(--denoise-border-strong)]"
                      )}
                    >
                      <span className="text-[15px]">{p.icon}</span>
                      <span className="text-[12px]">
                        {p.label.replace(p.icon, "").trim()}
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-[var(--denoise-border)]" />

            {/* Sections */}
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)] mb-2">
                Or pick sections manually
              </h3>
              <ul className="space-y-1">
                {ALL_SECTIONS.map((s) => {
                  const active = selectedSections.has(s.key);
                  return (
                    <li key={s.key}>
                      <label
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer",
                          active
                            ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)]"
                            : "border-[var(--denoise-border)] bg-[var(--denoise-bg)]"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            toggle(s.key, selectedSections, setSelectedSections)
                          }
                          className="accent-[var(--denoise-copper)]"
                        />
                        <span className="text-[12px] text-[var(--denoise-cream)]">
                          {s.label}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Department filter */}
            {availableDepts.length > 0 && (
              <>
                <hr className="border-[var(--denoise-border)]" />
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)] mb-2">
                    Departments (Props / Equipment filter)
                  </h3>
                  <p className="text-[11px] text-[var(--denoise-cream-muted)] mb-2">
                    Leave all unchecked to include every department.
                  </p>
                  <ul className="space-y-1">
                    {availableDepts.map((d) => {
                      const active = selectedDeptKinds.has(d.kind);
                      return (
                        <li key={d.id}>
                          <label
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer",
                              active
                                ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)]"
                                : "border-[var(--denoise-border)] bg-[var(--denoise-bg)]"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() =>
                                toggle(
                                  d.kind,
                                  selectedDeptKinds,
                                  setSelectedDeptKinds
                                )
                              }
                              className="accent-[var(--denoise-copper)]"
                            />
                            <span className="text-[12px] text-[var(--denoise-cream)] flex-1">
                              {d.name}
                            </span>
                            <span className="text-[10px] tabular-nums text-[var(--denoise-cream-muted)]">
                              {d.count}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="p-4 border-t border-[var(--denoise-border)] flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-9"
            >
              Cancel
            </Button>
            {selectedPresets.size > 0 ? (
              <Button
                onClick={applyPresetsAndPrint}
                className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print {selectedPresets.size} version
                {selectedPresets.size === 1 ? "" : "s"}
              </Button>
            ) : (
              <Button
                onClick={apply}
                className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium"
              >
                Apply
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
