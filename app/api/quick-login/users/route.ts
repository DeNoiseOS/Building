import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * V0.26 — Public list of users for the Quick Login picker.
 * Gated by NEXT_PUBLIC_QUICK_LOGIN=1. Returns basic identity fields
 * only (name / email / primaryRole). Never active in a real deploy.
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") {
    return NextResponse.json({ users: [] });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
    },
  });
  return NextResponse.json({ users });
}
