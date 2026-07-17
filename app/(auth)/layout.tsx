import { Clapperboard } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 app-aurora">
      <div className="w-full max-w-md relative">
        {/* Subtle glow behind the card */}
        <div className="absolute -inset-x-10 -inset-y-10 bg-primary/10 blur-3xl rounded-full opacity-50 pointer-events-none" />

        <div className="relative">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-soft">
                <Clapperboard className="h-4.5 w-4.5 text-white" />
              </span>
              <span className="text-xl font-semibold tracking-tight">
                DeNoise OS
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your professional operating system for creative production.
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
