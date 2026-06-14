import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Resolve the authenticated user for an API route. V0.2 returns name as well
 * as id so activity logging can attribute every event to a real person.
 */
export async function requireUser(): Promise<
  | { userId: string; userName: string; response?: never }
  | { userId?: never; userName?: never; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }
  return {
    userId: session.user.id,
    userName: session.user.name ?? "Someone",
  };
}

export function badRequest(message: string, fieldErrors?: unknown) {
  return NextResponse.json(
    { error: message, fieldErrors },
    { status: 400 }
  );
}

export function forbidden(message = "Not allowed.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong.") {
  return NextResponse.json({ error: message }, { status: 500 });
}
