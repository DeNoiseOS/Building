import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <div className="px-8 py-7 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5">Your preferences.</p>
      </header>

      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <h3 className="text-base font-semibold">Display</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Appearance and format preferences.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="theme">Theme</Label>
              <Badge
                variant="outline"
                className="bg-white/[0.04] border-white/[0.06] text-[10px]"
              >
                Dark
              </Badge>
            </div>
            <Input
              id="theme"
              defaultValue="Dark (always on)"
              disabled
              className="bg-white/[0.02] border-white/[0.06]"
            />
            <p className="text-xs text-muted-foreground">
              Theme switching ships in V0.2.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-format">Date Format</Label>
            <Input
              id="date-format"
              defaultValue="MMM d, yyyy"
              disabled
              className="bg-white/[0.02] border-white/[0.06]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <h3 className="text-base font-semibold">Account</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Account-level settings.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Time Zone</Label>
            <Input
              id="timezone"
              defaultValue="UTC"
              disabled
              className="bg-white/[0.02] border-white/[0.06]"
            />
          </div>
          <Button
            variant="outline"
            disabled
            className="bg-white/[0.03] border-white/[0.06]"
          >
            Change Password
          </Button>
          <p className="text-xs text-muted-foreground">
            Account management ships in V0.2.
          </p>
        </div>
      </div>
    </div>
  );
}
