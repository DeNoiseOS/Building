import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { isClientCaller } from "@/lib/permissions";

/**
 * V0.24 — Financial-page gate.
 *
 * Call at the top of any server component that hosts financial or
 * crew-management data (Budget, Resources, Reports, Tasks,
 * Departments admin actions). Redirects client-role viewers back
 * to the project overview.
 */
export async function redirectClientOff(params: {
  userId: string;
  projectId: string;
}): Promise<void> {
  if (await isClientCaller(params)) {
    redirect(`/projects/${params.projectId}`);
  }
}

/**
 * V0.24.1 — API-level guard. Call from any financial or crew-manage
 * route handler and return the response when it isn't null.
 *
 * Example:
 *   const denied = await denyClientAPI({ userId, projectId });
 *   if (denied) return denied;
 */
export async function denyClientAPI(params: {
  userId: string;
  projectId: string;
}): Promise<Response | null> {
  if (await isClientCaller(params)) {
    return NextResponse.json(
      { error: "Not allowed — agency roles can't touch this route." },
      { status: 403 }
    );
  }
  return null;
}
