import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/server-data";
import { ComingSoon } from "@/components/shared/coming-soon";
import { BarChart3 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectReportsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  return (
    <div className="pt-2">
      <ComingSoon
        icon={BarChart3}
        title="Project reports — coming soon"
        description="When this surface ships, you'll get call sheets, scene reports, prop lists, and department summaries composed from the work you've already tracked."
        features={[
          "Call Sheets",
          "Scene Reports",
          "Prop Lists",
          "Shoot Day Summaries",
        ]}
        shippingIn="Shipping in V3.2"
      />
    </div>
  );
}
