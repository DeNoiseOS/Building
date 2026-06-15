"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

/**
 * Server-action sign-in. NextAuth v5 beta's client-side `signIn` from
 * `next-auth/react` has a known CSRF-token bug with the Credentials
 * provider on Vercel that returns a raw "Bad request." HTTP 400. Using
 * the server-side `signIn` from `lib/auth.ts` bypasses the CSRF dance
 * entirely and is the v5-recommended path for Credentials.
 *
 * Returns { ok: true } on success and { error } on failure so the
 * client can surface a useful toast.
 */
export async function signInWithCredentials(formData: {
  email: string;
  password: string;
}) {
  try {
    await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirect: false,
    });
    return { ok: true as const };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false as const, error: err.type ?? err.message };
    }
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Sign-in failed.",
    };
  }
}
