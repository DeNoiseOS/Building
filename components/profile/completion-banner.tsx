"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * V0.12 — Profile completion banner.
 *
 * Shown by the app shell when the signed-in user's profile completion
 * is below 100 and they have not dismissed it. Skip persists via
 * `User.profileSkippedAt` so the banner stays gone across sessions.
 */
export function CompletionBanner({
  percent,
  missing,
}: {
  percent: number;
  missing: string[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden || percent >= 100) return null;

  function skip() {
    startTransition(async () => {
      setHidden(true);
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileSkippedAt: new Date().toISOString(),
        }),
      });
      router.refresh();
    });
  }

  return (
    <div className="border-b border-white/[0.06] bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent">
      <div className="px-6 py-2.5 flex items-center gap-3 text-sm">
        <UserCircle className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0 truncate">
          Your profile is{" "}
          <span className="font-semibold tabular-nums">{percent}%</span>{" "}
          complete.
          {missing.length > 0 && (
            <span className="text-muted-foreground ml-1">
              Missing: {missing.slice(0, 3).join(", ")}
              {missing.length > 3 ? "…" : ""}
            </span>
          )}
        </div>
        <Link href="/profile">
          <Button size="sm" variant="outline" className="h-7">
            Complete profile
          </Button>
        </Link>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={skip}
          disabled={pending}
          aria-label="Skip for now"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
