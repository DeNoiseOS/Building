import { forbidden, ok, unauthorized } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getProjectAssetDepartments } from "@/lib/scheduling/data";

/**
 * V0.29 — Client fetches available departments (with equipment) for
 * the Call Sheet export dialog's dept filter. Small read-only route;
 * access is gated by the resolver which calls assertProjectAccess.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized("unauthenticated");
  }
  try {
    const rows = await getProjectAssetDepartments(session.user.id, projectId);
    return ok(rows);
  } catch (err) {
    console.error(err);
    return forbidden("not accessible");
  }
}
