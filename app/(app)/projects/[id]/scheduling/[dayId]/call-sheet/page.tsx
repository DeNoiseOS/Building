import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getShootDayFull, getProjectCrewForCallSheet } from "@/lib/scheduling/data";
import { CallSheetView } from "@/components/scheduling/call-sheet-view";
import { CallSheetPrintBar } from "@/components/scheduling/call-sheet-print-bar";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import type { MealBreak } from "@/lib/scheduling/data";

/**
 * V0.30 — Call Sheet (print-optimised, multi-page).
 *
 * Query params drive what appears:
 *   ?sections=cover,schedule,cast,crew,clients,breakdowns,notes
 *   ?deptKinds=art_director,sound_department
 *   ?preset=full|sound|camera|art|cast|production
 */
export default async function CallSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; dayId: string }>;
  searchParams: Promise<{
    sections?: string;
    deptKinds?: string;
    preset?: string;
  }>;
}) {
  const { id: projectId, dayId } = await params;
  const query = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const day = await getShootDayFull(userId, dayId);
  if (!day || day.project.id !== projectId) notFound();

  // Fetch crew + agency clients in parallel
  const [crew, agencyMembers] = await Promise.all([
    getProjectCrewForCallSheet(userId, projectId),
    prisma.projectMember.findMany({
      where: {
        project: { AND: [projectAccessFilter(userId), { id: projectId }] },
        role: {
          in: [
            "agency_creative_director",
            "agency_art_buyer",
            "agency_client_producer",
            "agency_client_reviewer",
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            contactPhone: true,
            primaryRole: true,
          },
        },
      },
    }),
  ]);

  const sections = parseSections(query.sections, query.preset);
  const deptKinds = parseDeptKinds(query.deptKinds, query.preset);

  const mealTimes: MealBreak[] = Array.isArray(day.mealTimes)
    ? (day.mealTimes as unknown as MealBreak[])
    : [];

  // Location fallback: use day.locationName, or first scene's location
  const firstSceneItem = day.items.find((i) => i.kind === "scene" && i.scene?.location);
  const effectiveLocation = day.locationName ?? firstSceneItem?.scene?.location ?? null;

  // Cast aggregation across all scenes on the day
  const castByTalent = new Map<
    string,
    {
      talentId: string;
      name: string;
      characterName: string | null;
      headshotUrl: string | null;
      sceneNumbers: string[];
      callTime: Date | null;
    }
  >();
  for (const it of day.items) {
    if (!it.scene) continue;
    for (const link of it.scene.cast) {
      const existing = castByTalent.get(link.talent.id);
      if (existing) {
        existing.sceneNumbers.push(it.scene.number);
        if (link.callTime && (!existing.callTime || link.callTime < existing.callTime)) {
          existing.callTime = link.callTime;
        }
      } else {
        castByTalent.set(link.talent.id, {
          talentId: link.talent.id,
          name: link.talent.name,
          characterName: link.characterName ?? link.talent.characterName,
          headshotUrl: link.talent.headshotUrl,
          sceneNumbers: [it.scene.number],
          callTime: link.callTime ?? null,
        });
      }
    }
  }
  const cast = Array.from(castByTalent.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Group crew by canonical department bucket
  const crewByBucket = groupCrewByBucket(crew);

  return (
    <div className="call-sheet-print min-h-screen bg-white text-black">
      <CallSheetPrintBar
        projectId={projectId}
        dayId={dayId}
        activeSections={sections}
        activeDeptKinds={deptKinds}
      />
      <CallSheetView
        project={{ name: day.project.name }}
        day={{
          date: day.date,
          label: day.label,
          generalCallTime: day.generalCallTime,
          wrapTime: day.wrapTime,
          locationName: effectiveLocation,
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
        items={day.items.map((i) => ({
          id: i.id,
          order: i.order,
          kind: i.kind as "scene" | "prep" | "break" | "move" | "meal",
          label: i.label,
          startTime: i.startTime,
          endTime: i.endTime,
          durationMinutes: i.durationMinutes,
          notes: i.notes,
          scene: i.scene ?? undefined,
        }))}
        cast={cast}
        crewByBucket={crewByBucket}
        clients={agencyMembers.map((m) => ({
          id: m.userId,
          name: m.user.name,
          role: m.role,
          phone: m.user.contactPhone,
        }))}
        mealTimes={mealTimes}
        sections={sections}
        deptKinds={deptKinds}
      />
    </div>
  );
}

// ─── Section parsing ────────────────────────────────────────────────

const ALL_SECTIONS = [
  "cover",
  "schedule",
  "cast",
  "crew",
  "clients",
  "breakdowns",
  "notes",
] as const;
export type CallSheetSection = (typeof ALL_SECTIONS)[number];

const PRESETS: Record<string, CallSheetSection[]> = {
  full: [...ALL_SECTIONS],
  sound: ["cover", "schedule", "cast", "crew", "breakdowns"],
  camera: ["cover", "schedule", "cast", "crew", "breakdowns"],
  art: ["cover", "schedule", "cast", "crew", "breakdowns"],
  cast: ["cover", "schedule", "cast"], // slim view for the talent
  production: [...ALL_SECTIONS],
};

function parseSections(
  raw: string | undefined,
  preset: string | undefined,
): CallSheetSection[] {
  if (raw) {
    const wanted = new Set(raw.split(","));
    return ALL_SECTIONS.filter((s) => wanted.has(s));
  }
  if (preset && PRESETS[preset]) return PRESETS[preset];
  return [...ALL_SECTIONS];
}

function parseDeptKinds(
  raw: string | undefined,
  preset: string | undefined,
): string[] | null {
  if (raw) return raw.split(",").filter(Boolean);
  if (preset === "sound") return ["sound_department"];
  if (preset === "camera") return ["camera_department", "director_of_photography"];
  if (preset === "art") return ["art_director"];
  return null;
}

// ─── Crew bucketing ─────────────────────────────────────────────────

function groupCrewByBucket(
  crew: Awaited<ReturnType<typeof getProjectCrewForCallSheet>>,
): { bucket: string; members: typeof crew }[] {
  const BUCKETS: [string, RegExp][] = [
    ["Direction", /(producer|director|ep|executive)/i],
    ["Camera", /(dop|dp|camera|steadicam|focus|dit)/i],
    ["Sound", /(sound|boom|mixer)/i],
    ["Lighting & Grip", /(gaffer|grip|electrician|light)/i],
    ["Art", /(art|prod.*design|set|prop|wardrobe)/i],
    ["H\\MU", /(makeup|hair|mua)/i],
    ["Location", /(location)/i],
    ["Cast", /(cast|casting|talent)/i],
    ["Agency", /(agency|client)/i],
  ];
  const map = new Map<string, typeof crew>();
  const other: typeof crew = [];
  for (const m of crew) {
    const label = BUCKETS.find(([, rx]) => rx.test(m.role))?.[0] ?? null;
    if (label) {
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    } else {
      other.push(m);
    }
  }
  const out: { bucket: string; members: typeof crew }[] = [];
  for (const [label] of BUCKETS) {
    if (map.has(label)) out.push({ bucket: label, members: map.get(label)! });
  }
  if (other.length > 0) out.push({ bucket: "Other", members: other });
  return out;
}
