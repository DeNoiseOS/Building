import "server-only";
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
