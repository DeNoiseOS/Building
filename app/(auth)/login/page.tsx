"use client";

import { useState } from "react";
import { signInWithCredentials } from "../actions";
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
import { toast } from "sonner";

export default function LoginPage() {
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
      // CredentialsSignin → wrong password / unknown email.
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
    <Card className="border-white/[0.06] bg-card/80 backdrop-blur-md shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
        <CardDescription>Log in to continue your work.</CardDescription>
      </CardHeader>
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
    </Card>
  );
}
