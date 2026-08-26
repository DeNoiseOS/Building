import { format } from "date-fns";
import {
  MapPin,
  Phone,
  Sunrise,
  Sunset,
  Users,
  ClipboardList,
  StickyNote,
} from "lucide-react";
import { weatherIconFor } from "./weather-icons";
import { deptIconFor } from "./dept-icons";
import { assetTypeLabel } from "@/lib/scheduling/asset-types";
import { ROLE_LABELS } from "@/lib/roles";
import type { MealBreak } from "@/lib/scheduling/data";
import type { CallSheetSection } from "@/app/(app)/projects/[id]/scheduling/[dayId]/call-sheet/page";

/**
 * V0.30 — Call Sheet print view.
 *
 * Multi-page, editorial + operational hybrid. Each major section is
 * its own page (via `break-before: page`) so the printed deliverable
 * can be handed department-by-department:
 *
 *   Page 1 — Cover (logos, key times, weather, location, hospital, notes)
 *   Page 2 — Shooting Schedule (timeline: scenes + prep + break + move)
 *   Page 3 — Cast Call
 *   Page 4 — Crew List (grouped by department bucket)
 *   Page 5 — Clients / Agency
 *   Page 6+ — Per-scene breakdowns (one page each when there is enough content)
 *
 * The production logo (if uploaded) appears as a subtle watermark on
 * every page — geometry preserved, opacity ~6%, centered.
 */

type SceneRow = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  location: string | null;
  type: string;
  timeOfDay: string;
  notes: string | null;
  estimatedMinutes: number | null;
  pagesCount: string | null;
  coverImageUrl: string | null;
  cast: Array<{
    id: string;
    characterName: string | null;
    callTime: Date | null;
    talent: {
      id: string;
      name: string;
      characterName: string | null;
    };
  }>;
  assets: Array<{
    id: string;
    quantityNeeded: number;
    notes: string | null;
    assetTypeOverride: string | null;
    equipment: {
      id: string;
      name: string;
      assetType: string | null;
      department: { id: string; name: string; kind: string };
    };
  }>;
  departments: Array<{
    id: string;
    notes: string | null;
    department: { id: string; name: string; kind: string };
  }>;
};

type ItemRow = {
  id: string;
  order: number;
  kind: "scene" | "prep" | "break" | "move" | "meal";
  label: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  scene?: SceneRow;
};

type CastAgg = {
  talentId: string;
  name: string;
  characterName: string | null;
  headshotUrl: string | null;
  sceneNumbers: string[];
  callTime: Date | null;
};

type CrewMember = {
  id: string;
  userId: string;
  name: string;
  role: string;
  phone: string | null;
  profileImage: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
};

export function CallSheetView({
  project,
  day,
  items,
  cast,
  crewByBucket,
  clients,
  mealTimes,
  sections,
  deptKinds,
}: {
  project: { name: string };
  day: {
    date: Date;
    label: string | null;
    generalCallTime: string | null;
    wrapTime: string | null;
    locationName: string | null;
    locationAddress: string | null;
    weather: string | null;
    weatherIcon: string | null;
    sunrise: string | null;
    sunset: string | null;
    hospitalName: string | null;
    hospitalPhone: string | null;
    emergencyContact: string | null;
    generalNotes: string | null;
    productionLogoUrl: string | null;
    clientLogoUrl: string | null;
  };
  items: ItemRow[];
  cast: CastAgg[];
  crewByBucket: { bucket: string; members: CrewMember[] }[];
  clients: ClientRow[];
  mealTimes: MealBreak[];
  sections: CallSheetSection[];
  deptKinds: string[] | null;
}) {
  const show = new Set(sections);
  const filterAsset = (a: SceneRow["assets"][number]) =>
    deptKinds === null || deptKinds.includes(a.equipment.department.kind);
  const scenes = items.filter((i) => i.kind === "scene" && i.scene).map((i) => i.scene!);
  const WeatherIcon = weatherIconFor(day.weatherIcon);

  return (
    <div className="text-[12px] leading-normal">
      {/* Page 1 — Cover */}
      {show.has("cover") && (
        <Page productionLogoUrl={day.productionLogoUrl}>
          <PageHeader project={project} day={day} />
          <CoverBody day={day} mealTimes={mealTimes} WeatherIcon={WeatherIcon} />
        </Page>
      )}

      {/* Page 2 — Shooting Schedule */}
      {show.has("schedule") && items.length > 0 && (
        <Page productionLogoUrl={day.productionLogoUrl} breakBefore>
          <PageHeader project={project} day={day} compact />
          <SectionTitle title="Shooting Schedule" kicker="Timeline" />
          <ScheduleTable items={items} />
        </Page>
      )}

      {/* Page 3 — Cast Call */}
      {show.has("cast") && cast.length > 0 && (
        <Page productionLogoUrl={day.productionLogoUrl} breakBefore>
          <PageHeader project={project} day={day} compact />
          <SectionTitle title="Cast Call" kicker="Talent" />
          <CastTable cast={cast} />
        </Page>
      )}

      {/* Page 4 — Crew List */}
      {show.has("crew") && crewByBucket.length > 0 && (
        <Page productionLogoUrl={day.productionLogoUrl} breakBefore>
          <PageHeader project={project} day={day} compact />
          <SectionTitle title="Crew" kicker="Departments" />
          <CrewList groups={crewByBucket} defaultCall={day.generalCallTime} />
        </Page>
      )}

      {/* Page 5 — Clients */}
      {show.has("clients") && clients.length > 0 && (
        <Page productionLogoUrl={day.productionLogoUrl} breakBefore>
          <PageHeader project={project} day={day} compact />
          <SectionTitle title="Clients & Agency" kicker="External" />
          <ClientsTable clients={clients} />
        </Page>
      )}

      {/* Page 6+ — Per-scene breakdowns */}
      {show.has("breakdowns") &&
        scenes.map((s, i) => (
          <Page key={s.id} productionLogoUrl={day.productionLogoUrl} breakBefore>
            <PageHeader project={project} day={day} compact />
            <SceneBreakdown scene={s} index={i + 1} filterAsset={filterAsset} />
          </Page>
        ))}

      {/* Optional notes page — only when notes exist AND selected */}
      {show.has("notes") && day.generalNotes && (
        <Page productionLogoUrl={day.productionLogoUrl} breakBefore>
          <PageHeader project={project} day={day} compact />
          <SectionTitle title="Production Notes" kicker="Notes" />
          <p className="text-[13px] whitespace-pre-line leading-relaxed max-w-[720px]">
            {day.generalNotes}
          </p>
        </Page>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page shell (watermark + max-width + breaks)
// ═══════════════════════════════════════════════════════════════════

function Page({
  children,
  productionLogoUrl,
  breakBefore,
}: {
  children: React.ReactNode;
  productionLogoUrl: string | null;
  breakBefore?: boolean;
}) {
  return (
    <section
      className={`relative max-w-[900px] mx-auto px-8 py-8 print:px-6 print:py-6 ${
        breakBefore ? "print:break-before-page mt-8 print:mt-0" : ""
      }`}
    >
      {productionLogoUrl && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.06 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productionLogoUrl}
            alt=""
            className="max-w-[70%] max-h-[70%] object-contain"
          />
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Header (repeated on every page)
// ═══════════════════════════════════════════════════════════════════

function PageHeader({
  project,
  day,
  compact,
}: {
  project: { name: string };
  day: {
    date: Date;
    label: string | null;
    productionLogoUrl: string | null;
    clientLogoUrl: string | null;
  };
  compact?: boolean;
}) {
  const logoH = compact ? "h-8" : "h-14";
  return (
    <header
      className={`call-sheet-header flex items-center justify-between gap-4 border-b border-black pb-3 ${
        compact ? "mb-4" : "mb-6"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {day.productionLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={day.productionLogoUrl}
            alt="Production"
            className={`${logoH} w-auto object-contain`}
          />
        )}
      </div>
      <div className="text-center min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-[0.24em] text-black/60">
          {project.name}
        </p>
        {!compact && (
          <h1
            className="text-[28px] leading-none tracking-tight mt-1"
            style={{ fontFamily: "var(--font-serif-denoise, Georgia, serif)" }}
          >
            Call Sheet
          </h1>
        )}
        <p className="text-[11px] uppercase tracking-[0.16em] text-black/70 mt-1 tabular-nums">
          {format(day.date, "EEE · MMM d, yyyy")}
          {day.label && <span className="opacity-60"> · {day.label}</span>}
        </p>
      </div>
      <div className="flex items-center gap-3 min-w-0 justify-end">
        {day.clientLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={day.clientLogoUrl}
            alt="Client"
            className={`${logoH} w-auto object-contain`}
          />
        )}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Cover body
// ═══════════════════════════════════════════════════════════════════

function CoverBody({
  day,
  mealTimes,
  WeatherIcon,
}: {
  day: {
    generalCallTime: string | null;
    wrapTime: string | null;
    locationName: string | null;
    locationAddress: string | null;
    weather: string | null;
    sunrise: string | null;
    sunset: string | null;
    hospitalName: string | null;
    hospitalPhone: string | null;
    emergencyContact: string | null;
    generalNotes: string | null;
  };
  mealTimes: MealBreak[];
  WeatherIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <>
      {/* Key times band */}
      <div className="grid grid-cols-3 border-2 border-black divide-x-2 divide-black mb-5">
        <KeyTime label="Crew Call" value={day.generalCallTime ?? "—"} />
        <KeyTime label="Camera Roll" value="—" placeholder />
        <KeyTime label="Est. Wrap" value={day.wrapTime ?? "—"} />
      </div>

      {/* Weather + Sun */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-[11px]">
        <div className="border border-black/30 p-3 flex items-center gap-3">
          <WeatherIcon className="h-8 w-8" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-black/50">
              Weather
            </p>
            <p className="text-[14px] mt-0.5">{day.weather ?? "—"}</p>
          </div>
        </div>
        <div className="border border-black/30 p-3 flex items-center gap-3">
          <Sunrise className="h-8 w-8" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-black/50">
              Sunrise
            </p>
            <p className="text-[14px] tabular-nums mt-0.5">{day.sunrise ?? "—"}</p>
          </div>
        </div>
        <div className="border border-black/30 p-3 flex items-center gap-3">
          <Sunset className="h-8 w-8" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-black/50">Sunset</p>
            <p className="text-[14px] tabular-nums mt-0.5">{day.sunset ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Location + Hospital + Emergency stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mb-6">
        <div>
          <Kicker>Location</Kicker>
          <div className="mt-1 flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-[13px]">
              <p className="font-medium">{day.locationName ?? "—"}</p>
              {day.locationAddress && (
                <p className="text-black/60 text-[11px] mt-0.5 break-words">
                  {day.locationAddress.startsWith("http") ? (
                    <a
                      href={day.locationAddress}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {day.locationAddress}
                    </a>
                  ) : (
                    day.locationAddress
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
        {(day.hospitalName || day.hospitalPhone) && (
          <div>
            <Kicker>Nearest Hospital</Kicker>
            <div className="mt-1 flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-[13px]">
                {day.hospitalName && <p className="font-medium">{day.hospitalName}</p>}
                {day.hospitalPhone && (
                  <p className="text-black/60 text-[11px] mt-0.5">{day.hospitalPhone}</p>
                )}
              </div>
            </div>
          </div>
        )}
        {day.emergencyContact && (
          <div>
            <Kicker>Emergency Contact</Kicker>
            <div className="mt-1 flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-[13px]">{day.emergencyContact}</p>
            </div>
          </div>
        )}
        {mealTimes.length > 0 && (
          <div>
            <Kicker>Meals</Kicker>
            <ul className="text-[12px] mt-1 space-y-0.5">
              {mealTimes.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.label}</span>
                  {" · "}
                  <span className="tabular-nums">{m.time}</span>
                  <span className="text-black/50"> ({m.durationMinutes}m)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {day.generalNotes && (
        <div className="mt-6 pt-4 border-t border-black/30">
          <Kicker>Notes</Kicker>
          <p className="text-[12px] mt-2 whitespace-pre-line max-w-[720px]">
            {day.generalNotes}
          </p>
        </div>
      )}
    </>
  );
}

function KeyTime({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
}) {
  return (
    <div className="px-5 py-4 text-center">
      <p className="text-[9px] uppercase tracking-[0.20em] text-black/60">{label}</p>
      <p
        className={`text-[26px] tabular-nums mt-1 ${placeholder ? "text-black/40" : ""}`}
        style={{ fontFamily: "var(--font-serif-denoise, Georgia, serif)" }}
      >
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Schedule table (timeline)
// ═══════════════════════════════════════════════════════════════════

function ScheduleTable({ items }: { items: ItemRow[] }) {
  return (
    <table className="w-full text-[11px] border-collapse mt-3">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="py-1.5 pr-2 font-medium w-8">#</th>
          <th className="py-1.5 pr-2 font-medium w-24">Time</th>
          <th className="py-1.5 pr-2 font-medium w-14">Type</th>
          <th className="py-1.5 pr-2 font-medium w-10">Scn</th>
          <th className="py-1.5 pr-2 font-medium">Description</th>
          <th className="py-1.5 pr-2 font-medium w-14">D/N</th>
          <th className="py-1.5 pr-2 font-medium w-24">Location</th>
          <th className="py-1.5 pr-2 font-medium w-8 text-right">Cast</th>
          <th className="py-1.5 pr-2 font-medium w-10 text-right">Pgs</th>
          <th className="py-1.5 font-medium w-12 text-right">Est.</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <ScheduleRow key={it.id} item={it} index={i + 1} />
        ))}
      </tbody>
    </table>
  );
}

function ScheduleRow({ item, index }: { item: ItemRow; index: number }) {
  const isScene = item.kind === "scene" && item.scene;
  const timeSlot = item.startTime
    ? `${item.startTime}${item.endTime ? "–" + item.endTime : ""}`
    : "";
  return (
    <tr
      className={`border-b border-black/20 align-top ${
        !isScene ? "bg-black/[0.04]" : ""
      }`}
    >
      <td className="py-1.5 pr-2 tabular-nums text-black/60">
        {String(index).padStart(2, "0")}
      </td>
      <td className="py-1.5 pr-2 tabular-nums">{timeSlot}</td>
      <td className="py-1.5 pr-2 uppercase text-[9px] tracking-[0.14em]">{item.kind}</td>
      {isScene && item.scene ? (
        <>
          <td className="py-1.5 pr-2 tabular-nums font-medium">{item.scene.number}</td>
          <td className="py-1.5 pr-2">{item.scene.title}</td>
          <td className="py-1.5 pr-2 uppercase text-[9px] tracking-[0.14em]">
            {item.scene.type} / {item.scene.timeOfDay}
          </td>
          <td className="py-1.5 pr-2 text-black/70 truncate max-w-[180px]">
            {item.scene.location ?? "—"}
          </td>
          <td className="py-1.5 pr-2 tabular-nums text-black/70 text-right">
            {item.scene.cast.length}
          </td>
          <td className="py-1.5 pr-2 tabular-nums text-black/70 text-right">
            {item.scene.pagesCount ?? "—"}
          </td>
          <td className="py-1.5 tabular-nums text-black/70 text-right">
            {item.scene.estimatedMinutes ? `${item.scene.estimatedMinutes}m` : "—"}
          </td>
        </>
      ) : (
        <td className="py-1.5 pr-2 italic text-black/70" colSpan={7}>
          {item.label ?? item.kind}
          {item.notes && (
            <span className="text-black/50 not-italic"> — {item.notes}</span>
          )}
        </td>
      )}
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Cast Call table
// ═══════════════════════════════════════════════════════════════════

function CastTable({ cast }: { cast: CastAgg[] }) {
  return (
    <table className="w-full text-[11px] border-collapse mt-3">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="py-1.5 pr-2 font-medium">Actor</th>
          <th className="py-1.5 pr-2 font-medium">Character</th>
          <th className="py-1.5 pr-2 font-medium">Scenes</th>
          <th className="py-1.5 font-medium">Call</th>
        </tr>
      </thead>
      <tbody>
        {cast.map((c) => (
          <tr key={c.talentId} className="border-b border-black/20">
            <td className="py-1.5 pr-2 font-medium">{c.name}</td>
            <td className="py-1.5 pr-2 text-black/70">{c.characterName ?? "—"}</td>
            <td className="py-1.5 pr-2 tabular-nums text-black/70">
              {c.sceneNumbers.join(", ")}
            </td>
            <td className="py-1.5 tabular-nums text-black/70">
              {c.callTime ? format(c.callTime, "HH:mm") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Crew list
// ═══════════════════════════════════════════════════════════════════

function CrewList({
  groups,
  defaultCall,
}: {
  groups: { bucket: string; members: CrewMember[] }[];
  defaultCall: string | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      {groups.map((g) => {
        const Icon = deptIconFor(g.members[0]?.role ?? "");
        return (
          <div
            key={g.bucket}
            className="break-inside-avoid border border-black/40 bg-white"
          >
            <div className="bg-black text-white px-3 py-1.5 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              <p className="text-[10px] uppercase tracking-[0.20em] font-medium">
                {g.bucket}
              </p>
              <span className="ml-auto text-[10px] tabular-nums opacity-80">
                {g.members.length}
              </span>
            </div>
            <ul className="divide-y divide-black/15">
              {g.members.map((m) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium truncate">{m.name}</p>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-black/60 truncate">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </p>
                  </div>
                  <span className="text-[10px] text-black/70 whitespace-nowrap tabular-nums">
                    {m.phone ?? "—"}
                  </span>
                  <span className="text-[11px] tabular-nums font-medium min-w-[42px] text-right">
                    {defaultCall ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Clients table
// ═══════════════════════════════════════════════════════════════════

function ClientsTable({ clients }: { clients: ClientRow[] }) {
  return (
    <table className="w-full text-[11px] border-collapse mt-3 max-w-[720px]">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="py-1.5 pr-2 font-medium">Name</th>
          <th className="py-1.5 pr-2 font-medium">Role</th>
          <th className="py-1.5 font-medium">Phone</th>
        </tr>
      </thead>
      <tbody>
        {clients.map((c) => (
          <tr key={c.id} className="border-b border-black/20">
            <td className="py-1.5 pr-2 font-medium">{c.name}</td>
            <td className="py-1.5 pr-2 text-black/70">{ROLE_LABELS[c.role] ?? c.role}</td>
            <td className="py-1.5 text-black/70 whitespace-nowrap">{c.phone ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Scene breakdown
// ═══════════════════════════════════════════════════════════════════

function SceneBreakdown({
  scene,
  index,
  filterAsset,
}: {
  scene: SceneRow;
  index: number;
  filterAsset: (a: SceneRow["assets"][number]) => boolean;
}) {
  const filteredAssets = scene.assets.filter(filterAsset);
  // Group assets by department kind so each dept becomes its own box.
  const assetsByDept = new Map<
    string,
    { deptName: string; deptKind: string; items: typeof filteredAssets }
  >();
  for (const a of filteredAssets) {
    const k = a.equipment.department.kind;
    if (!assetsByDept.has(k)) {
      assetsByDept.set(k, {
        deptName: a.equipment.department.name,
        deptKind: a.equipment.department.kind,
        items: [],
      });
    }
    assetsByDept.get(k)!.items.push(a);
  }
  const deptBoxes = Array.from(assetsByDept.values()).sort((a, b) =>
    a.deptName.localeCompare(b.deptName),
  );

  // Fast lookup: dept notes by dept kind (from SceneDepartment.notes).
  const deptNotesByKind = new Map<string, string>();
  for (const d of scene.departments) {
    if (d.notes && d.notes.trim().length > 0) {
      deptNotesByKind.set(d.department.kind, d.notes);
    }
  }

  return (
    <>
      {/* Scene header band */}
      <div className="border-2 border-black mb-4">
        <div className="bg-black text-white px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.20em] tabular-nums opacity-80">
              Order {String(index).padStart(2, "0")}
            </span>
            <span className="opacity-40">/</span>
            <span className="text-[13px] font-medium tabular-nums">
              Scene {scene.number}
            </span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] opacity-90 text-right">
            {scene.type} · {scene.timeOfDay}
            {scene.pagesCount && <> · {scene.pagesCount} pg</>}
            {scene.estimatedMinutes && <> · {scene.estimatedMinutes}m</>}
          </div>
        </div>
        <div className="px-4 py-3">
          <h2
            className="text-[22px] leading-tight"
            style={{ fontFamily: "var(--font-serif-denoise, Georgia, serif)" }}
          >
            {scene.title}
          </h2>
          {scene.location && (
            <p className="text-[11px] text-black/70 mt-1 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {scene.location}
            </p>
          )}
        </div>
      </div>

      {/* Cover + Description + Notes row */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 mb-3">
        {scene.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.coverImageUrl}
            alt=""
            className="w-full aspect-[4/3] object-cover border border-black/40"
          />
        ) : (
          <div className="w-full aspect-[4/3] border border-dashed border-black/30 flex items-center justify-center text-[9px] uppercase tracking-[0.18em] text-black/40">
            No cover image
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {scene.description && (
            <BreakdownBox icon={ClipboardList} title="Description">
              <p className="text-[12px] text-black/85 leading-relaxed whitespace-pre-line">
                {scene.description}
              </p>
            </BreakdownBox>
          )}
          {scene.notes && (
            <BreakdownBox icon={StickyNote} title="Scene Notes" accent>
              <p className="text-[12px] text-black/85 whitespace-pre-line">
                {scene.notes}
              </p>
            </BreakdownBox>
          )}
        </div>
      </div>

      {/* Department boxes — one per dept + Cast */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scene.cast.length > 0 && (
          <BreakdownBox icon={Users} title="Cast" count={scene.cast.length}>
            <ul className="text-[11px] space-y-1">
              {scene.cast.map((c) => (
                <li key={c.id} className="grid grid-cols-[1fr_auto] gap-2 items-baseline">
                  <div className="min-w-0">
                    <span className="font-medium">{c.talent.name}</span>
                    {(c.characterName ?? c.talent.characterName) && (
                      <span className="text-black/60 text-[10px]">
                        {" · "}as {c.characterName ?? c.talent.characterName}
                      </span>
                    )}
                  </div>
                  {c.callTime && (
                    <span className="text-[10px] tabular-nums text-black/70">
                      {format(c.callTime, "HH:mm")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </BreakdownBox>
        )}
        {deptBoxes.map((d) => {
          const Icon = deptIconFor(d.deptKind);
          const deptNote = deptNotesByKind.get(d.deptKind);
          // Group items in this dept by the effective type (override > default).
          const byType = new Map<string, typeof d.items>();
          for (const a of d.items) {
            const key = a.assetTypeOverride ?? a.equipment.assetType ?? "general";
            if (!byType.has(key)) byType.set(key, []);
            byType.get(key)!.push(a);
          }
          // Prefer showing typed groups (Action, Raccord) before General.
          const typeKeys = Array.from(byType.keys()).sort((a, b) =>
            a === "general" ? 1 : b === "general" ? -1 : a.localeCompare(b),
          );
          const hasSpecialTypes = typeKeys.some((k) => k !== "general");
          return (
            <BreakdownBox
              key={d.deptKind}
              icon={Icon}
              title={d.deptName}
              count={d.items.length}
            >
              {hasSpecialTypes ? (
                <div className="space-y-2">
                  {typeKeys.map((key) => {
                    const items = byType.get(key)!;
                    const label = assetTypeLabel(d.deptKind, key);
                    return (
                      <div key={key}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[9px] uppercase tracking-[0.14em] text-black/60 font-medium">
                            {label}
                          </span>
                          <span className="text-[9px] tabular-nums text-black/50">
                            × {items.length}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 leading-snug">
                          {items
                            .map(
                              (a) =>
                                a.equipment.name +
                                (a.quantityNeeded > 1 ? ` × ${a.quantityNeeded}` : ""),
                            )
                            .join(" · ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ul className="text-[11px] space-y-1">
                  {d.items.map((a) => (
                    <li
                      key={a.id}
                      className="grid grid-cols-[1fr_auto] gap-2 items-baseline"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{a.equipment.name}</span>
                        {a.notes && (
                          <span className="text-black/60 text-[10px]">
                            {" · "}
                            {a.notes}
                          </span>
                        )}
                      </div>
                      {a.quantityNeeded > 1 && (
                        <span className="text-[10px] tabular-nums text-black/70">
                          × {a.quantityNeeded}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {deptNote && (
                <div className="mt-3 pt-2 border-t border-black/15">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-black/60 mb-1">
                    Notes
                  </p>
                  <p className="text-[11px] whitespace-pre-line text-black/80">
                    {deptNote}
                  </p>
                </div>
              )}
            </BreakdownBox>
          );
        })}
        {/* Depts that have notes but no assets — still deserve a note box. */}
        {scene.departments
          .filter(
            (d) =>
              d.notes &&
              d.notes.trim() &&
              !deptBoxes.some((db) => db.deptKind === d.department.kind),
          )
          .map((d) => {
            const Icon = deptIconFor(d.department.kind);
            return (
              <BreakdownBox key={d.id} icon={Icon} title={d.department.name}>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-black/60 mb-1">
                    Notes
                  </p>
                  <p className="text-[11px] whitespace-pre-line text-black/80">
                    {d.notes}
                  </p>
                </div>
              </BreakdownBox>
            );
          })}
      </div>

      {scene.departments.length > 0 && (
        <p className="mt-3 text-[9px] uppercase tracking-[0.18em] text-black/60">
          Involved departments:{" "}
          <span className="text-black">
            {scene.departments.map((d) => d.department.name).join(" · ")}
          </span>
        </p>
      )}
    </>
  );
}

/** A single bordered box used across the scene breakdown grid. */
function BreakdownBox({
  icon: Icon,
  title,
  count,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border ${
        accent ? "border-black" : "border-black/40"
      } bg-white break-inside-avoid`}
    >
      <div
        className={`px-3 py-1.5 flex items-center gap-2 ${
          accent ? "bg-black text-white" : "border-b border-black/20 bg-black/[0.03]"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] uppercase tracking-[0.20em] font-medium">{title}</p>
        {typeof count === "number" && (
          <span className="ml-auto text-[10px] tabular-nums opacity-80">{count}</span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Bits
// ═══════════════════════════════════════════════════════════════════

function SectionTitle({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <div className="mb-4">
      {kicker && (
        <p className="text-[9px] uppercase tracking-[0.22em] text-black/60">{kicker}</p>
      )}
      <h2
        className="text-[22px] leading-none mt-1"
        style={{ fontFamily: "var(--font-serif-denoise, Georgia, serif)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.20em] text-black/60">{children}</p>
  );
}
