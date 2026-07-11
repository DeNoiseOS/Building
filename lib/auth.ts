import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

/**
 * V0.26 — Quick-login token: a short-lived JWT signed with AUTH_SECRET
 * that the /api/quick-login endpoint returns. The `quicklogin`
 * Credentials provider verifies it before minting a session. Only
 * active while NEXT_PUBLIC_QUICK_LOGIN is set (testing).
 */
async function verifyQuickToken(token: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );
    const sub = payload.sub;
    if (typeof sub !== "string") return null;
    return sub;
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Explicitly trust the Vercel host. NextAuth v5 beta normally reads
  // AUTH_TRUST_HOST from env, but the env-only path is flaky behind
  // Vercel's proxy and causes credentials sign-in to return "Bad request".
  // Setting it directly here is the canonical fix.
  trustHost: true,
  // Secret resolution: AUTH_SECRET is the v5 name, NEXTAUTH_SECRET is the
  // v4 fallback. Read either env var so both setups work.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    // V0.26 — Quick login (testing). Gate: NEXT_PUBLIC_QUICK_LOGIN=1.
    Credentials({
      id: "quicklogin",
      name: "Quick login",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") return null;
        if (!credentials?.token) return null;
        const userId = await verifyQuickToken(credentials.token as string);
        if (!userId) return null;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
