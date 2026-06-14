import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ComingSoon } from "@/components/shared/coming-soon";
import { Sliders } from "lucide-react";

export default async function CustomizePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="px-8 py-7 max-w-5xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Sliders className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Customize</h1>
        </div>
        <p className="text-muted-foreground mt-1.5">
          Tailor ProductionOS to the way you work.
        </p>
      </header>

      <ComingSoon
        icon={Sliders}
        title="Personalization is on the way"
        description="Soon you'll be able to choose accent colors, surface densities, default views, and the way your dashboard composes itself for each role you work in."
        features={[
          "Accent color",
          "Default Persona",
          "Dashboard composition",
          "Surface density",
          "Notification preferences",
          "Keyboard shortcuts",
        ]}
        shippingIn="Shipping in V0.2"
      />
    </div>
  );
}
