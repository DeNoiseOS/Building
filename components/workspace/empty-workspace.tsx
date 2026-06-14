import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { LayoutPanelTop } from "lucide-react";

interface EmptyWorkspaceProps {
  role: string;
}

/**
 * Defensive render path: shown when the project's role isn't mapped in
 * lib/sections.ts. In V0.1 the three supported roles are all mapped, but
 * this protects future roles that may land before their workspace
 * composition is defined.
 */
export function EmptyWorkspace({ role }: EmptyWorkspaceProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6 gap-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <LayoutPanelTop className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1 max-w-md">
          <CardTitle className="text-lg">
            Workspace not configured for this role
          </CardTitle>
          <CardDescription>
            The role <code className="text-foreground">{role}</code> doesn&apos;t have a
            workspace composition yet. Open the Tasks tab to keep moving while
            we ship this role&apos;s workspace.
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}
