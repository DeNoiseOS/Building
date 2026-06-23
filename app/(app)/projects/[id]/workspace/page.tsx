import { redirect } from "next/navigation";

/**
 * V0.20 — Workspace was renamed to Production Bible. Old links keep
 * working via this redirect.
 */
export default async function WorkspaceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/bible`);
}
