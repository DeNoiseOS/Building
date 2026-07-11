"use client";

import { useState } from "react";
import {
  signInWithCredentials,
  signInWithQuickToken,
} from "../actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { DEPARTMENTS } from "@/lib/department-registry";
import { toast } from "sonner";
import { Zap, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * V0.26.1 — Login page.
 *
 * Real users see email + password.
 * With NEXT_PUBLIC_QUICK_LOGIN=1 they also get the "Sign in as..."
 * role picker at the top — role personas are shared across projects,
 * so invitations to a role instantly work with them.
 */
export default function LoginPage() {
  const quickLoginEnabled = process.env.NEXT_PUBLIC_QUICK_LOGIN === "1";
  const [tab, setTab] = useState<"quick" | "password">(
    quickLoginEnabled ? "quick" : "password"
  );

  return (
    <Card className="border-white/[0.06] bg-card/80 backdrop-blur-md shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
        <CardDescription>
          {quickLoginEnabled
            ? "Sign in as a role persona to test the system."
            : "Log in to continue your work."}
        </CardDescription>
      </CardHeader>

      {quickLoginEnabled && (
        <div className="px-6 -mt-2">
          <div className="inline-flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
            <button
              type="button"
              onClick={() => setTab("quick")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-[5px]",
                tab === "quick"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className="h-3 w-3" />
              Sign in as role
            </button>
            <button
              type="button"
              onClick={() => setTab("password")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-[5px]",
                tab === "password"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LogIn className="h-3 w-3" />
              Email + password
            </button>
          </div>
        </div>
      )}

      {tab === "password" ? <PasswordForm /> : <RolePicker />}
    </Card>
  );
}

function PasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await signInWithCredentials({ email, password });
    setLoading(false);
    if (!result.ok) {
      if (result.error === "CredentialsSignin") {
        toast.error("Invalid email or password.");
      } else {
        toast.error(`Sign-in failed — ${result.error}`);
      }
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-10 bg-white/[0.02] border-white/[0.08]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-10 bg-white/[0.02] border-white/[0.08]"
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 mt-6">
        <Button
          type="submit"
          className="w-full h-10 bg-gradient-to-br from-primary to-violet-600 hover:from-primary/95 hover:to-violet-600/95 text-white border-0 shadow-soft"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
          >
            Register
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}

const CROSS_DEPT_ROLES = [
  "executive_producer",
  "producer",
  "director",
  "assistant_director",
  "first_assistant_director",
];

const AGENCY_ROLES = [
  "agency_creative_director",
  "agency_copywriter",
  "agency_brand_manager",
  "agency_account_manager",
];

function RolePicker() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const sections: { key: string; label: string; roles: string[] }[] = [
    // Production leadership (cross-department)
    {
      key: "leadership",
      label: "Production Leadership",
      roles: CROSS_DEPT_ROLES,
    },
    // One card per department
    ...DEPARTMENTS.map((d) => ({
      key: d.key,
      label: d.label,
      roles: [...d.headRoles, ...d.memberRoles],
    })),
    // Agency (client)
    {
      key: "agency",
      label: "Agency (Client)",
      roles: AGENCY_ROLES,
    },
  ];

  async function signInAsRole(role: string) {
    setLoading(role);
    const res = await fetch("/api/quick-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      setLoading(null);
      toast.error(data.error ?? "Sign-in failed.");
      return;
    }
    const result = await signInWithQuickToken(data.token);
    setLoading(null);
    if (!result.ok) {
      toast.error(`Sign-in failed — ${result.error}`);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <CardContent className="space-y-4">
      <div className="text-[11px] text-muted-foreground rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
        Testing mode. Each role is a shared persona — everyone signing
        in as &ldquo;Director&rdquo; lands in the same account. Turn off
        NEXT_PUBLIC_QUICK_LOGIN before shipping to real users.
      </div>
      <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
        {sections.map((section) => (
          <div key={section.key} className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
              {section.label}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {section.roles.map((role) => (
                <button
                  type="button"
                  key={role}
                  disabled={loading !== null}
                  onClick={() => signInAsRole(role)}
                  className={cn(
                    "text-left text-xs rounded-md px-2.5 py-2 border transition-colors",
                    "border-white/[0.06] bg-white/[0.02] hover:bg-primary/10 hover:border-primary/25 hover:text-primary",
                    loading === role && "opacity-50"
                  )}
                >
                  {loading === role
                    ? "Signing in…"
                    : ROLE_LABELS[role] ?? role}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  );
}
