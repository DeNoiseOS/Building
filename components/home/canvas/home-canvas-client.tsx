"use client";

import dynamic from "next/dynamic";
import type { HomeLayout } from "@/lib/widgets/schema";
import type { WidgetData } from "@/lib/widgets/data/fetch-all";

/**
 * V0.28 Phase B — Client-only wrapper for HomeCanvas.
 *
 * dnd-kit generates fresh unique ids on every render, which produces
 * an SSR/client mismatch on `aria-describedby`. The canvas needs JS
 * to be interactive at all, so we skip SSR entirely.
 */
const HomeCanvasNoSSR = dynamic(
  () => import("./home-canvas").then((m) => m.HomeCanvas),
  {
    ssr: false,
    // No visible loading state — the dynamic import resolves before
    // paint on any modern machine. A visible placeholder here would
    // flash during router.refresh() and read as "the page broke".
    loading: () => <div className="min-h-[400px]" aria-hidden />,
  }
);

export function HomeCanvasClient({
  initialLayout,
  initialData,
}: {
  initialLayout: HomeLayout;
  initialData: Record<string, WidgetData>;
}) {
  return (
    <HomeCanvasNoSSR
      initialLayout={initialLayout}
      initialData={initialData}
    />
  );
}
