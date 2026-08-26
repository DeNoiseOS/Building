/**
 * Startup env guards.
 *
 * Each function here runs once at server startup (via
 * `instrumentation.ts`). Depending on severity, a check may either
 * throw (fail-fast, refuse to boot) or emit a warning to logs so an
 * operator can act on it without an outage.
 *
 * Keep everything here cheap and pure — a slow check turns every cold
 * start into a user-visible delay.
 */

/**
 * Warn — do NOT throw — when Quick Login is enabled in production.
 *
 * Quick Login (`/quick-login`) bypasses password authentication so
 * anyone who reaches it can sign in as any user. It exists for local
 * development. On a shared/production deploy, leaving this flag on
 * is a live risk — but the risk is only realized if the deployment
 * URL is publicly reachable (custom domain, Vercel Protection off,
 * or a shared preview link).
 *
 * V0.5-audit decision: we chose the SOFT variant of this check —
 * warn instead of throw — because the current production deploy
 * intentionally keeps quick-login on for the solo user's convenience
 * (protected by Vercel SSO). The warning gives us a loud reminder
 * in Vercel logs at every cold start so the flag doesn't quietly
 * outlive its safety window.
 *
 * To harden later: swap `console.warn` for `throw new Error(...)`
 * once NEXT_PUBLIC_QUICK_LOGIN is removed from the Production
 * environment on Vercel.
 */
export function warnIfQuickLoginInProduction(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const quickLoginEnabled = process.env.NEXT_PUBLIC_QUICK_LOGIN === "1";
  if (isProduction && quickLoginEnabled) {
    console.warn(
      [
        "",
        "⚠️  QUICK LOGIN IS ENABLED IN PRODUCTION  ⚠️",
        "",
        "  NEXT_PUBLIC_QUICK_LOGIN=1 is set with NODE_ENV=production.",
        "  Anyone who can reach /quick-login on this deployment can sign",
        "  in as any user without a password.",
        "",
        "  This is only safe while the deployment stays behind Vercel",
        "  Protection or another gate. If you add a custom domain or",
        "  disable protection, remove NEXT_PUBLIC_QUICK_LOGIN from the",
        "  Production environment immediately.",
        "",
        "  (This warning was emitted by lib/env-check.ts.)",
        "",
      ].join("\n"),
    );
  }
}

/**
 * Runs every startup check in order. New checks belong here.
 */
export function runStartupChecks(): void {
  warnIfQuickLoginInProduction();
}
