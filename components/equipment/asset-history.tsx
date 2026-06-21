"use client";

/**
 * V0.16 — Asset history timeline.
 *
 * Client component that fetches /history and renders a chronological
 * list of events. Designed to slot into the existing equipment detail
 * panel without redesigning the page.
 */

import { useEffect, useState } from "react";
import {
  Plus,
  ArrowLeft,
  AlertTriangle,
  Wrench,
  ShoppingCart,
  Package,
  CheckCircle2,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface HistoryEvent {
  at: string;
  kind:
    | "created"
    | "purchased"
    | "assigned"
    | "returned"
    | "damaged"
    | "under_review"
    | "resolved"
    | "maintenance_started"
    | "maintenance_completed";
  label: string;
  actor?: { id: string; name: string } | null;
  detail?: string | null;
}

const KIND_ICON: Record<HistoryEvent["kind"], LucideIcon> = {
  created: Plus,
  purchased: ShoppingCart,
  assigned: Package,
  returned: ArrowLeft,
  damaged: AlertTriangle,
  under_review: Eye,
  resolved: CheckCircle2,
  maintenance_started: Wrench,
  maintenance_completed: CheckCircle2,
};

const KIND_COLOR: Record<HistoryEvent["kind"], string> = {
  created: "text-muted-foreground",
  purchased: "text-primary",
  assigned: "text-primary",
  returned: "text-emerald-300",
  damaged: "text-red-300",
  under_review: "text-amber-300",
  resolved: "text-emerald-300",
  maintenance_started: "text-amber-300",
  maintenance_completed: "text-emerald-300",
};

export function AssetHistory({
  projectId,
  equipmentId,
}: {
  projectId: string;
  equipmentId: string;
}) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/equipment/${equipmentId}/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) setEvents(data.history ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, equipmentId]);

  if (error) {
    return (
      <div className="text-xs text-red-300 italic">
        Could not load history.
      </div>
    );
  }
  if (events === null) {
    return <div className="text-xs text-muted-foreground">Loading…</div>;
  }
  if (events.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">No history yet.</div>
    );
  }

  return (
    <ol className="relative space-y-3 pl-6 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-white/[0.06]">
      {events.map((e, i) => {
        const Icon = KIND_ICON[e.kind];
        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-6 top-0.5 h-4 w-4 rounded-full bg-card border border-white/[0.08] flex items-center justify-center ${KIND_COLOR[e.kind]}`}
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="text-sm">{e.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.at).toLocaleString()}
              {e.actor ? ` · ${e.actor.name}` : ""}
            </div>
            {e.detail && (
              <div className="text-xs text-muted-foreground mt-0.5 italic">
                {e.detail}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
