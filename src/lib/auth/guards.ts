import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import type { User } from "@/db/schema";

const MESSAGES: Record<number, string> = {
  401: "Not logged in", 402: "Paid account required", 403: "Admin only",
};

export class AuthError extends Error {
  constructor(public status: number) {
    super(MESSAGES[status] ?? "Forbidden");
  }
}

export async function getRequestUser(): Promise<User | null> {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const user = await getRequestUser();
  if (!user) throw new AuthError(401);
  return user;
}

export async function requirePaid(): Promise<User> {
  const user = await requireUser();
  if (!user.isPaid && user.role !== "admin") throw new AuthError(402);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError(403);
  return user;
}

export function authErrorResponse(e: unknown): Response | null {
  if (e instanceof AuthError)
    return Response.json({ error: e.message }, { status: e.status });
  return null;
}
