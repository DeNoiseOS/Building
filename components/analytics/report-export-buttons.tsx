"use client";

/**
 * V0.21 — Report export bar.
 *
 * Three CSV exports (Financial / Departments / Scenes) + a "Print"
 * button that triggers window.print() — combined with the print
 * stylesheet on /reports, this gives a one-click Save-as-PDF flow.
 */

import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

export function ReportExportButtons({ projectId }: { projectId: string }) {
  function csvHref(kind: "financial" | "departments" | "scenes") {
    return `/api/projects/${projectId}/reports/export?kind=${kind}`;
  }
  return (
    <div className="flex items-center gap-2 no-print flex-wrap">
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={csvHref("financial")} download>
          <Download className="h-3.5 w-3.5" />
          Financial CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={csvHref("departments")} download>
          <Download className="h-3.5 w-3.5" />
          Departments CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={csvHref("scenes")} download>
          <Download className="h-3.5 w-3.5" />
          Scenes CSV
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => window.print()}
      >
        <Printer className="h-3.5 w-3.5" />
        Print / PDF
      </Button>
    </div>
  );
}
