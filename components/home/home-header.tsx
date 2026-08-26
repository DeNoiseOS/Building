import Link from "next/link";
import { format } from "date-fns";
import { DollarSign, Megaphone, Sparkles } from "lucide-react";
import { NewTaskButton } from "@/components/tasks/new-task-button";

/**
 * V0.27.3 — Editorial command-center header.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  [wordmark]                                    [wave motif]  │
 *   │  tagline                                                     │
 *   │                                                              │
 *   │  GOOD EVENING                              [ New Task ] ...  │
 *   │  Faris.                                                      │
 *   │  metadata                                                    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Wordmark is absolutely anchored to top-left; greeting sits on its own
 * flex row at the bottom; wave motif spans the full width behind
 * everything, faded out under the actions cluster on the right.
 *
 * The DeNoise Logo.svg has ~6% internal padding on every side and a
 * black background baked in. We compensate with negative margins and
 * `mix-blend-mode: screen` — the source SVG is never modified.
 */
export function HomeHeader({
  firstName,
  greeting,
  activeProjectsCount,
  now,
  defaultProject,
  projectChoices,
  currentUserId,
  currentUserName,
  canCreateAnnouncement,
  canInviteSomewhere,
}: {
  firstName: string;
  greeting: string;
  activeProjectsCount: number;
  now: Date;
  defaultProject: { id: string; name: string } | null;
  projectChoices: { id: string; name: string }[];
  currentUserId: string;
  currentUserName: string;
  canCreateAnnouncement: boolean;
  canInviteSomewhere: boolean;
}) {
  const productionCount =
    activeProjectsCount === 0
      ? "00 ACTIVE PRODUCTIONS"
      : `${String(activeProjectsCount).padStart(2, "0")} ACTIVE PRODUCTION${activeProjectsCount === 1 ? "" : "S"}`;

  return (
    <header className="relative overflow-hidden rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)]">
      {/* Wave motif — full-width behind everything, using the
       * authoritative DeNoise wave asset as a CSS mask. Geometry
       * preserved 1:1; only color, position and scale adapt. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.14]"
        style={{
          WebkitMaskImage: "url(/logo/denoise-wave.svg)",
          maskImage: "url(/logo/denoise-wave.svg)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "140% auto",
          maskSize: "140% auto",
          WebkitMaskPosition: "70% 30%",
          maskPosition: "70% 30%",
          backgroundColor: "var(--denoise-copper)",
        }}
      />
      {/* Soft gradient behind the button cluster so the wave doesn't
       * fight with the CTAs */}
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-[36%] pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, var(--denoise-surface) 30%, transparent)",
        }}
      />

      {/* Greeting + actions row. Brand + tagline now live in the sidebar. */}
      <div className="relative min-h-[180px] flex flex-col justify-end px-6 lg:px-8 py-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 lg:gap-8 items-end">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--denoise-cream)]/60">
              {greeting}
            </div>
            <h1
              className="mt-1 text-[52px] lg:text-[64px] leading-[0.95] text-[var(--denoise-cream)] tracking-tight"
              style={{ fontFamily: "var(--font-serif-denoise)" }}
            >
              {firstName}.
            </h1>
            <div className="mt-3 flex items-center gap-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream)]/60">
              <span>{format(now, "EEEE, MMMM d, yyyy")}</span>
              <span className="h-[3px] w-[3px] rounded-full bg-[var(--denoise-copper)]" />
              <span>{productionCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end relative z-10">
            {defaultProject && (
              <NewTaskButton
                projectChoices={projectChoices}
                currentUser={{ id: currentUserId, name: currentUserName }}
                variant="outline"
                className="!h-10 !px-4 !rounded-[var(--radius-home)] !border-transparent !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black !font-medium !shadow-none !bg-none"
              />
            )}
            {defaultProject && (
              <Link
                href={`/projects/${defaultProject.id}/budget`}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[var(--radius-home)] border border-[var(--denoise-border-strong)] bg-transparent hover:bg-[var(--denoise-surface-2)] text-sm text-[var(--denoise-cream)] transition-colors"
              >
                <DollarSign className="h-4 w-4 text-[var(--denoise-cream-muted)]" />
                New expense
              </Link>
            )}
            {canCreateAnnouncement && defaultProject && (
              <Link
                href={`/projects/${defaultProject.id}/announcements`}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[var(--radius-home)] border border-[var(--denoise-border-strong)] bg-transparent hover:bg-[var(--denoise-surface-2)] text-sm text-[var(--denoise-cream)] transition-colors"
              >
                <Megaphone className="h-4 w-4 text-[var(--denoise-cream-muted)]" />
                New announcement
              </Link>
            )}
            {canInviteSomewhere && defaultProject && (
              <Link
                href={`/projects/${defaultProject.id}/members`}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[var(--radius-home)] border border-[var(--denoise-border-strong)] bg-transparent hover:bg-[var(--denoise-surface-2)] text-sm text-[var(--denoise-cream)] transition-colors"
              >
                <Sparkles className="h-4 w-4 text-[var(--denoise-cream-muted)]" />
                Invite
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
