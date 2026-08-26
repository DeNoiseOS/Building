import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageScene } from "@/lib/permissions";
import {
  getShootDayFull,
  getUnscheduledScenes,
} from "@/lib/scheduling/data";
import {
  ShootDayEditor,
  type ShootDayItemRow,
} from "@/components/scheduling/shoot-day-editor";

export default async function ShootDayPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>;
}) {
  const { id: projectId, dayId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const day = await getShootDayFull(userId, dayId);
  if (!day || day.project.id !== projectId) notFound();

  const [unscheduled, canEdit] = await Promise.all([
    getUnscheduledScenes(userId, projectId),
    canManageScene({ userId, projectId }),
  ]);

  const items: ShootDayItemRow[] = day.items.map((it) => ({
    id: it.id,
    kind: it.kind as ShootDayItemRow["kind"],
    order: it.order,
    label: it.label,
    startTime: it.startTime,
    endTime: it.endTime,
    durationMinutes: it.durationMinutes,
    notes: it.notes,
    scene: it.scene
      ? {
          id: it.scene.id,
          number: it.scene.number,
          title: it.scene.title,
          type: it.scene.type,
          timeOfDay: it.scene.timeOfDay,
          location: it.scene.location,
          estimatedMinutes: it.scene.estimatedMinutes,
          pagesCount: it.scene.pagesCount,
          castCount: it.scene.cast.length,
          assetCount: it.scene.assets.length,
        }
      : undefined,
  }));

  // Auto-location: pull from the FIRST scene item's location if the
  // shoot day has no explicit locationName.
  const firstSceneItem = items.find((i) => i.kind === "scene" && i.scene?.location);
  const autoLocationHint = firstSceneItem?.scene?.location ?? null;

  return (
    <ShootDayEditor
      projectId={projectId}
      shootDay={{
        id: day.id,
        date: day.date.toISOString(),
        label: day.label,
        generalCallTime: day.generalCallTime,
        wrapTime: day.wrapTime,
        locationName: day.locationName,
        locationAddress: day.locationAddress,
        weather: day.weather,
        weatherIcon: day.weatherIcon,
        sunrise: day.sunrise,
        sunset: day.sunset,
        hospitalName: day.hospitalName,
        hospitalPhone: day.hospitalPhone,
        emergencyContact: day.emergencyContact,
        generalNotes: day.generalNotes,
        productionLogoUrl: day.productionLogoUrl,
        clientLogoUrl: day.clientLogoUrl,
      }}
      items={items}
      unscheduled={unscheduled}
      autoLocationHint={autoLocationHint}
      canEdit={canEdit}
    />
  );
}
