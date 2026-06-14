import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ComingSoon } from "@/components/shared/coming-soon";
import { BarChart3 } from "lucide-react";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
        </div>
        <p className="text-muted-foreground mt-1.5">
          Production intelligence across your entire portfolio.
        </p>
      </header>

      <ComingSoon
        icon={BarChart3}
        title="Reports are on the way"
        description="ProductionOS will generate the reports your productions actually need — call sheets, scene reports, prop lists, purchase orders, shoot-day summaries — all composed from the data you're already capturing."
        features={[
          "Call Sheets",
          "Scene Reports",
          "Prop Lists",
          "Purchase Orders",
          "Shoot Day Reports",
          "Department Summaries",
        ]}
        shippingIn="Shipping in V3.2"
      />
    </div>
  );
}
