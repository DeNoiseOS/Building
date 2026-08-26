import { runStartupChecks } from "@/lib/env-check";

/**
 * Next.js startup hook.
 *
 * Runs once per serverless function cold start (or once at `next dev`
 * startup) before any HTTP request is handled. Throwing here prevents
 * the runtime from serving traffic — which is exactly what we want
 * for env misconfigurations that would compromise auth.
 */
export function register(): void {
  runStartupChecks();
}
