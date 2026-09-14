"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/api";
import {
  HomeLayoutSchema,
  WidgetInstanceSchema,
  type HomeLayout,
  type WidgetGeometry,
  type WidgetInstance,
  type WidgetType,
} from "@/lib/widgets/schema";
import {
  getHomeLayoutForUser,
  resetHomeLayoutForUser,
  saveHomeLayoutForUser,
} from "@/lib/widgets/layout-server";
import { widgetDefinition } from "@/lib/widgets/registry";

/**
 * V0.28 — Home Command Center: server actions.
 *
 * Every action re-authenticates, re-validates with Zod, and re-writes
 * the whole layout row. Layout is small (10s of widgets, hundreds of
 * bytes each) so full replacement is fine and keeps the persistence
 * model trivial.
 */

async function commit(
  userId: string,
  next: HomeLayout,
  revalidate = false,
): Promise<void> {
  await saveHomeLayoutForUser(userId, next);
  // Only revalidate when the server needs to send fresh widget DATA
  // (add/duplicate/remove/reconfigure change the data payload map).
  // Pure geometry changes (move/resize) keep the same data, so we
  // skip the revalidate — that avoids remounting the client canvas
  // and flashing the "Loading Command Center…" placeholder.
  if (revalidate) revalidatePath("/home");
}

function newId(): string {
  return randomBytes(9).toString("base64url");
}

// ─── Actions ────────────────────────────────────────────────────────

/** Add a widget of the given type using the registry's defaults.
 *  Optionally accepts an explicit geometry. */
export async function addWidgetAction(input: {
  type: WidgetType;
  geometry?: WidgetGeometry;
}): Promise<{ ok: true; instanceId: string }> {
  const userId = await requireUserId();
  const layout = await getHomeLayoutForUser(userId);
  const def = widgetDefinition(input.type);
  const geometry: WidgetGeometry = input.geometry ?? {
    x: 0,
    y: nextFreeRow(layout),
    w: def.defaultW,
    h: def.defaultH,
  };
  const base = def.defaultConfig();
  const instance = WidgetInstanceSchema.parse({
    id: newId(),
    ...geometry,
    ...base,
  });
  const next: HomeLayout = {
    version: 1,
    widgets: [...layout.widgets, instance],
  };
  await commit(userId, next, true); // new widget → server payload needed
  return { ok: true, instanceId: instance.id };
}

/** Remove a widget instance by id. */
export async function removeWidgetAction(instanceId: string): Promise<void> {
  const userId = await requireUserId();
  const layout = await getHomeLayoutForUser(userId);
  const next: HomeLayout = {
    version: 1,
    widgets: layout.widgets.filter((w) => w.id !== instanceId),
  };
  await commit(userId, next, true);
}

/** Duplicate a widget instance — copies config, offsets y by one row. */
export async function duplicateWidgetAction(instanceId: string): Promise<{
  ok: true;
  newInstanceId: string;
}> {
  const userId = await requireUserId();
  const layout = await getHomeLayoutForUser(userId);
  const src = layout.widgets.find((w) => w.id === instanceId);
  if (!src) throw new Error("widget not found");
  const clone: WidgetInstance = {
    ...src,
    id: newId(),
    y: nextFreeRow(layout),
  } as WidgetInstance;
  const next: HomeLayout = {
    version: 1,
    widgets: [...layout.widgets, clone],
  };
  await commit(userId, next, true);
  return { ok: true, newInstanceId: clone.id };
}

/** Replace geometry (move + resize handled through the same call). */
export async function updateGeometryAction(input: {
  instanceId: string;
  geometry: WidgetGeometry;
}): Promise<void> {
  const userId = await requireUserId();
  const layout = await getHomeLayoutForUser(userId);
  const idx = layout.widgets.findIndex((w) => w.id === input.instanceId);
  if (idx === -1) throw new Error("widget not found");

  const def = widgetDefinition(layout.widgets[idx].type);
  const clamped = clampGeometry(input.geometry, def);

  const next: HomeLayout = {
    version: 1,
    widgets: layout.widgets.map((w) =>
      w.id === input.instanceId ? { ...w, ...clamped } : w,
    ),
  };
  // Geometry-only change → skip revalidate (client already reflects it)
  await commit(userId, HomeLayoutSchema.parse(next), false);
}

/** Replace the config for a widget instance. */
export async function updateConfigAction(input: {
  instanceId: string;
  config: unknown;
}): Promise<void> {
  const userId = await requireUserId();
  const layout = await getHomeLayoutForUser(userId);
  const target = layout.widgets.find((w) => w.id === input.instanceId);
  if (!target) throw new Error("widget not found");

  const def = widgetDefinition(target.type);
  const validatedConfig = def.configSchema.parse(input.config);
  const next: HomeLayout = {
    version: 1,
    widgets: layout.widgets.map((w) =>
      w.id === input.instanceId
        ? ({ ...w, config: validatedConfig } as WidgetInstance)
        : w,
    ),
  };
  // Config change may affect the widget's rendered data — revalidate.
  await commit(userId, HomeLayoutSchema.parse(next), true);
}

/** Replace the layout wholesale — used by drag/resize batches. Pure
 *  geometry, so skip revalidate to keep the client stable. */
export async function replaceLayoutAction(nextLayout: HomeLayout): Promise<void> {
  const userId = await requireUserId();
  const validated = HomeLayoutSchema.parse(nextLayout);
  await commit(userId, validated, false);
}

/** Reset — deletes the row, default layout serves next read. */
export async function resetLayoutAction(): Promise<void> {
  const userId = await requireUserId();
  await resetHomeLayoutForUser(userId);
  revalidatePath("/home");
}

// ─── helpers ────────────────────────────────────────────────────────

function nextFreeRow(layout: HomeLayout): number {
  let bottom = 0;
  for (const w of layout.widgets) {
    const b = w.y + w.h;
    if (b > bottom) bottom = b;
  }
  return bottom;
}

function clampGeometry(
  g: WidgetGeometry,
  def: ReturnType<typeof widgetDefinition>,
): WidgetGeometry {
  const w = Math.max(def.minW, Math.min(def.maxW ?? 12, g.w));
  const h = Math.max(def.minH, Math.min(def.maxH ?? 24, g.h));
  const x = Math.max(0, Math.min(12 - w, g.x));
  const y = Math.max(0, g.y);
  return { x, y, w, h };
}
