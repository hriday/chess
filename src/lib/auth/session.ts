import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

export const SESSION_COOKIE = "chess_session";

export function generateSessionToken(): string {
  return randomBytes(24).toString("hex");
}

// Sessions are stored/looked-up by the SHA-256 hash of the raw cookie token, not the
// token itself, so a leaked DB row (backup, replica, SQL injection read) can't be used
// to forge a session cookie. The raw token in the cookie is unchanged.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + 30 * 24 * 3600 * 1000);
}

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  await db.insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt: sessionExpiry() });
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const id = hashSessionToken(token);
  const rows = await db.select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id));
  if (rows.length === 0) return null;
  if (rows[0].expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return rows[0].user;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
}
