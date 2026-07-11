"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { toast } from "sonner";
import { Zap, LogIn, UserPlus2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KnownUser {
  id: string;
  name: string;
  email: string;
  primaryRole: string | null;
}

export default function LoginPage() {
  const quickLoginEnabled = process.env.NEXT_PUBLIC_QUICK_LOGIN === "1";
  const [tab, setTab] = useState<"password" | "quick">(
    quickLoginEnabled ? "quick" : "password"
  );

  return (
    <Card className="border-white/[0.06] bg-card/80 backdrop-blur-md shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
        <CardDescription>Log in to continue your work.</CardDescription>
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
              Quick login
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

      {tab === "password" ? <PasswordForm /> : <QuickForm />}
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

/**
 * V0.26 — Quick login form. Two modes side by side:
 *  - Left: existing users list, one click to sign in.
 *  - Right: name + role → create a persona.
 */
function QuickForm() {
  const router = useRouter();
  const [users, setUsers] = useState<KnownUser[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Create-new state
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>(ROLES[0]?.value ?? "");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch("/api/quick-login/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({ users: [] }));
      if (!cancel) setUsers(data.users ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  async function loginAs(
    body: { userId: string } | { name: string; role: string },
    key: string
  ) {
    setLoading(key);
    const res = await fetch("/api/quick-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      setLoading(null);
      toast.error(data.error ?? "Quick login failed.");
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

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role) return;
    await loginAs({ name: name.trim(), role }, "new");
  }

  return (
    <CardContent className="space-y-4">
      <div className="text-[11px] text-muted-foreground rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
        Testing mode. Password-free sign-in for personas. Turn off
        NEXT_PUBLIC_QUICK_LOGIN before shipping to real users.
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Sign in as an existing persona
        </Label>
        {users === null ? (
          <div className="text-xs text-muted-foreground py-2">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            No users yet. Create one below.
          </div>
        ) : (
          <div className="max-h-[220px] overflow-y-auto space-y-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            {users.map((u) => (
              <button
                type="button"
                key={u.id}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2 flex items-center gap-3 hover:bg-white/[0.05] transition-colors",
                  loading === u.id && "opacity-50"
                )}
                disabled={loading !== null}
                onClick={() => loginAs({ userId: u.id }, u.id)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/25 text-primary flex items-center justify-center text-xs font-semibold">
                  {u.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {u.primaryRole
                      ? ROLE_LABELS[u.primaryRole] ?? u.primaryRole
                      : u.email}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] pt-4 space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <UserPlus2 className="h-3 w-3" />
          Or create a new persona
        </Label>
        <form onSubmit={submitNew} className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Persona name (e.g. Sarah Producer)"
            className="h-9"
            maxLength={80}
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            className="w-full h-9"
            disabled={loading !== null || !name.trim() || !role}
          >
            {loading === "new" ? "Signing in…" : "Create & sign in"}
          </Button>
        </form>
      </div>
    </CardContent>
  );
}
