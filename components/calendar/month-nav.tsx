"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";

interface MonthNavProps {
  monthDate: Date;
}

function toQueryDate(d: Date): string {
  return format(d, "yyyy-MM");
}

export function MonthNav({ monthDate }: MonthNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function go(delta: number) {
    const next = addMonths(monthDate, delta);
    const params = new URLSearchParams(sp.toString());
    params.set("m", toQueryDate(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  function today() {
    const params = new URLSearchParams(sp.toString());
    params.delete("m");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={today}
        className="bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] h-8"
      >
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => go(-1)}
        className="h-8 w-8 hover:bg-white/[0.05]"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => go(1)}
        className="h-8 w-8 hover:bg-white/[0.05]"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
