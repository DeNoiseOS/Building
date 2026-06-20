"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Local error boundary for the budget page. Surfaces the actual server
 * error message + stack so we can debug without combing Vercel logs.
 * Replace with a friendlier UI once the cause is fixed.
 */
export default function BudgetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[budget/error.tsx]", error);
  }, [error]);

  return (
    <div className="px-8 py-7 space-y-4">
      <h1 className="text-2xl font-semibold">Budget page failed to render</h1>
      <p className="text-sm text-muted-foreground">
        Sharing this with the developer to fix.
      </p>
      <pre className="rounded-lg bg-card/60 border border-white/[0.06] p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
        <strong>{error.name}: {error.message}</strong>
        {error.digest && `\n\nDigest: ${error.digest}`}
        {error.stack && `\n\n${error.stack}`}
      </pre>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
